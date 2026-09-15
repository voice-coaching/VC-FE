"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { RouteTransition } from "@/components/route-transition";
import { SessionGate } from "@/components/session-gate";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SessionGate>
        <RouteTransition>{children}</RouteTransition>
      </SessionGate>
    </QueryClientProvider>
  );
}
