"use client";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LoginMethods } from "@/components/login-methods";
import { TopBar } from "@/components/top-bar";
import { safeInternalPath } from "@/lib/navigation";

export default function Auth() {
  const searchParams = useSearchParams();
  const returnTo = safeInternalPath(searchParams.get("next"), "/home");

  return (
    <AppShell nav={false}>
      <TopBar to="/" title="로그인" />
      <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col px-6 pt-10 pb-12">
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-3xl leading-tight font-bold tracking-tight whitespace-pre-line">
            {"다시 만나서\n반가워요"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            사용하실 계정으로 계속해 주세요.
          </p>
        </div>

        <LoginMethods returnTo={returnTo} />
      </div>
    </AppShell>
  );
}
