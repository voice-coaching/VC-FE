"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { forceDevSession } from "@/lib/dev-account";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  useEffect(() => {
    if (forceDevSession()) return;
    // OAuth 콜백에서는 인가 코드 교환과 토큰 복원이 경쟁하지 않도록 건너뜁니다.
    if (window.location.pathname.startsWith("/oauth/")) return;
    // Access Token이 없거나 만료된 경우 보호 API의 401 처리에서 HttpOnly
    // Refresh Token 쿠키로 갱신하고 동일 요청을 한 번 재시도합니다.
    void api.users.getMe().catch(() => undefined);
import { useEffect, useState, type ReactNode } from "react";
import { forceDevSession } from "@/lib/dev-account";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  useEffect(() => {
    forceDevSession();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
