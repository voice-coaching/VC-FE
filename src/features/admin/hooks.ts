"use client";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthSessionVersion, subscribeAuthSession } from "@/lib/api/client";
import { adminApi, adminErrorMessage } from "./api";
import { adminReadPolicy, affectedAdminRead } from "./cache";
import type { Query } from "./types";
export function useAdminSession(): number {
  return useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionVersion,
    () => 0,
  );
}
export function useAdminQuery<T>(
  path: string,
  query: Query = {},
  enabled = true,
) {
  const session = useAdminSession();
  return useQuery<T>({
    queryKey: ["admin", session, path, query],
    queryFn: ({ signal }) => adminApi.read<T>(path, query, signal),
    enabled,
    retry: false,
    ...adminReadPolicy(path, query),
    refetchOnWindowFocus: true,
  });
}
/** Commands never retry automatically; retain the form when the outcome is uncertain. */
export function useAdminCommand(invalidationPaths: readonly string[] = ["*"]) {
  const invalidationKey = invalidationPaths.join("|");
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const queries = useQueryClient();
  const session = useAdminSession();
  const run = useCallback(
    async <T>(command: () => Promise<T>, onSuccess?: (result: T) => void) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      setSuccess(null);
      try {
        const result = await command();
        if (getAuthSessionVersion() !== session) return;
        setSuccess("변경사항을 저장했습니다.");
        onSuccess?.(result);
        await queries.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "admin" &&
            query.queryKey[1] === session &&
            affectedAdminRead(
              query.queryKey[2],
              invalidationKey.split("|").filter(Boolean),
            ),
        });
      } catch (reason) {
        if (getAuthSessionVersion() === session)
          setError(adminErrorMessage(reason));
      } finally {
        busyRef.current = false;
        if (getAuthSessionVersion() === session) setBusy(false);
      }
    },
    [queries, session, invalidationKey],
  );
  const clearFeedback = useCallback(() => {
    if (busyRef.current) return;
    setError(null);
    setSuccess(null);
  }, []);
  return { busy, error, success, run, clearFeedback };
}
