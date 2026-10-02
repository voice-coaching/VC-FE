"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { SessionGate } from "@/components/session-gate";
import { installNavigationHistory } from "@/lib/navigation-history";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => installNavigationHistory(window.history), []);
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SessionGate>{children}</SessionGate>
    </QueryClientProvider>
  );
}
