"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ApiError,
  getAuthSessionVersion,
  subscribeAuthSession,
} from "@/lib/api/client";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { COACHING_USAGE_CHANGED } from "@/lib/coaching-usage";

/** Owner-scoped advisory data; the server decides each admission. No persistent cache. */
export function useCoachingUsage() {
  const epoch = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionVersion,
    () => 0,
  );
  const userId = getAuthenticatedUserId();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["coaching-usage", userId, epoch],
    enabled: Boolean(userId),
    queryFn: async () => {
      const result = await api.users.getCoachingUsage();
      if (epoch !== getAuthSessionVersion())
        throw new ApiError(
          "로그인 상태가 변경됐어요.",
          409,
          "AUTH_SESSION_CHANGED",
        );
      return result;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });
  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: ["coaching-usage", userId, epoch],
      });
    };
    window.addEventListener(COACHING_USAGE_CHANGED, refresh);
    return () => window.removeEventListener(COACHING_USAGE_CHANGED, refresh);
  }, [queryClient, userId, epoch]);
  const expiresAt = query.data?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const delay = Date.parse(expiresAt) - Date.now();
    if (delay <= 0) return;
    // Re-arm long periods instead of overflowing the browser's 32-bit timer.
    let timer: number;
    const arm = () => {
      const remaining = Date.parse(expiresAt) - Date.now();
      if (remaining <= 0) {
        void queryClient.invalidateQueries({
          queryKey: ["coaching-usage", userId, epoch],
        });
        return;
      }
      timer = window.setTimeout(arm, Math.min(remaining + 50, 2_147_483_647));
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [expiresAt, queryClient, userId, epoch]);
  return query;
}
