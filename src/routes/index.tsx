"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { SocialProvider } from "@/lib/api";
import { redirectToOAuthProvider } from "@/lib/oauth";

export default function Landing() {
  const [oauthProvider, setOAuthProvider] = useState<SocialProvider | null>(
    null,
  );
  const [oauthError, setOAuthError] = useState<string | null>(null);

  function startOAuth(provider: SocialProvider) {
    setOAuthProvider(provider);
    setOAuthError(null);
    try {
      redirectToOAuthProvider(provider);
    } catch (reason) {
      setOAuthProvider(null);
      setOAuthError(
        reason instanceof Error ? reason.message : "SNS 로그인에 실패했습니다.",
      );
    }
  }

  return (
    <AppShell nav={false}>
      <div className="flex min-h-dvh flex-col justify-between px-6 py-14">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-5xl font-black tracking-tighter">SpeakAI</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            아나운서처럼 또렷하게.
            <br />
            AI가 음절 하나까지 들어드립니다.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={oauthProvider !== null}
            onClick={() => startOAuth("KAKAO")}
            className="w-full rounded-full bg-warning py-4 text-center text-sm font-semibold text-warning-foreground"
          >
            {oauthProvider === "KAKAO"
              ? "카카오로 이동 중…"
              : "카카오로 시작하기"}
          </button>
          <button
            type="button"
            disabled={oauthProvider !== null}
            onClick={() => startOAuth("GOOGLE")}
            className="w-full rounded-full border border-border bg-background py-4 text-center text-sm font-semibold text-foreground"
          >
            {oauthProvider === "GOOGLE" ? "구글로 이동 중…" : "구글로 시작하기"}
          </button>
          {oauthError && (
            <p
              role="alert"
              className="px-2 text-center text-xs text-destructive"
            >
              {oauthError}
            </p>
          )}
          <Link
            href="/auth"
            className="w-full rounded-full bg-foreground py-4 text-center text-sm font-semibold text-background"
          >
            이메일로 회원가입
          </Link>
          <p className="pt-2 text-center text-xs text-muted-foreground">
            이미 계정이 있나요?{" "}
            <Link
              href="/auth?mode=login"
              className="font-semibold text-foreground underline"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
