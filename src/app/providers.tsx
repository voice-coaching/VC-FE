"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { installAdminCacheLifecycle } from "@/features/admin/cache";
import { SessionGate } from "@/components/session-gate";
import { installNavigationHistory } from "@/lib/navigation-history";
import { AndroidPushEvents } from "@/components/android-push-events";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => installNavigationHistory(window.history), []);
  const [queryClient] = useState(() => new QueryClient());
  useEffect(() => installAdminCacheLifecycle(queryClient), [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionGate>
        <AndroidPushEvents />
        {children}
      </SessionGate>
    </QueryClientProvider>
  );
}
