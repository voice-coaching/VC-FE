import type { QueryClient } from "@tanstack/react-query";
import { getAuthSessionVersion, subscribeAuthSession } from "@/lib/api/client";
import { subscribeAdminDenial } from "./api";

/** UI memory only: HTTP/proxy responses remain no-store and permission checks are never cached. */
const cachedRecords = new Set([
  "TRAINING_SESSIONS",
  "RECORDINGS",
  "ANALYSES",
  "COURSE_PROGRESS",
  "TITLES",
  "TITLE_EXAMS",
  "DIRECT_ANALYSES",
  "PRIVATE_CONTENTS",
  "ONBOARDING",
  "SCRIPT_LIBRARY",
  "NOTIFICATIONS",
  "NOTIFICATION_SETTINGS",
  "PROFILE_IMAGES",
  "ANALYSIS_SEGMENTS",
]);
export function adminReadPolicy(
  path: string,
  query: Record<string, unknown> = {},
) {
  if (path === "/content-categories")
    return { staleTime: 300_000, gcTime: 600_000 };
  if (path === "/contents" || path === "/notices")
    return { staleTime: 30_000, gcTime: 120_000 };
  if (path === "/users" || path === "/popups")
    return { staleTime: 10_000, gcTime: 60_000 };
  if (
    path === "/inquiries" ||
    path === "/audit-logs" ||
    path === "/notification-campaigns"
  )
    return { staleTime: 5_000, gcTime: 30_000 };
  if (
    /^\/users\/\d+\/records$/.test(path) &&
    cachedRecords.has(String(query.resource))
  )
    return { staleTime: 5_000, gcTime: 30_000 };
  // Access, editable versions, deletion timestamps, playback URLs and unknown endpoints stay fresh.
  return { staleTime: 0, gcTime: 0 };
}
export function affectedAdminRead(path: unknown, prefixes: readonly string[]) {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    prefixes.some(
      (prefix) =>
        prefix.length > 0 &&
        (prefix === "*" || path === prefix || path.startsWith(`${prefix}/`)),
    )
  );
}
/** Purge old account data even when the user leaves the admin routes before signing out. */
export function installAdminCacheLifecycle(queries: QueryClient) {
  const clear = (oldOnly: boolean) => {
    const current = getAuthSessionVersion();
    const predicate = (query: { queryKey: readonly unknown[] }) =>
      query.queryKey[0] === "admin" &&
      (!oldOnly || query.queryKey[1] !== current);
    void queries.cancelQueries({ predicate });
    queries.removeQueries({ predicate });
  };
  const session = subscribeAuthSession(() => clear(true));
  const denied = subscribeAdminDenial(() => clear(false));
  return () => {
    session();
    denied();
  };
}
