"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, type SocialProvider } from "@/lib/api";
import { clearOAuthAttempt, consumeOAuthAttempt } from "@/lib/oauth";

export function OAuthCallback({
  provider,
  code,
  state,
  oauthError,
  errorDescription,
}: {
  provider: SocialProvider;
  code?: string;
  state?: string;
  oauthError?: string;
  errorDescription?: string;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const providerLabel = provider === "GOOGLE" ? "Google" : "카카오";

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (oauthError) {
      clearOAuthAttempt(provider);
      setError(
        oauthError === "access_denied"
          ? `${providerLabel} 로그인이 취소되었습니다.`
          : errorDescription || `${providerLabel} 인증 중 오류가 발생했습니다.`,
      );
      return;
    }

    if (!code || !state) {
      clearOAuthAttempt(provider);
      setError(
        "OAuth 인가 코드 또는 보안 상태값이 없습니다. 로그인을 다시 시도해 주세요.",
      );
      return;
    }

    const attempt = consumeOAuthAttempt(provider, state);
    if (!attempt) {
      setError("로그인 요청이 만료되었거나 보안 상태값이 일치하지 않습니다.");
      return;
    }

    api.auth
      .socialLogin({
        provider,
        authorizationCode: code,
        redirectUri: attempt.redirectUri,
      })
      .then((session) => {
        router.replace(
          session.isNewUser || session.onboardingRequired
            ? "/onboarding"
            : "/home",
        );
      })
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "SNS 로그인에 실패했습니다.",
        );
      });
  }, [
    code,
    errorDescription,
    oauthError,
    provider,
    providerLabel,
    router,
    state,
  ]);

  return (
    <AppShell nav={false}>
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-bold">로그인을 완료하지 못했어요</h1>
            <p
              role="alert"
              className="mt-3 text-sm leading-relaxed text-muted-foreground"
            >
              {error}
            </p>
            <Link
              href="/auth"
              className="mt-6 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
            >
              로그인 화면으로 돌아가기
            </Link>
          </>
        ) : (
          <>
            <span className="size-10 animate-spin rounded-full border-4 border-border border-t-foreground" />
            <h1 className="mt-5 text-xl font-bold">
              {providerLabel} 로그인 확인 중
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              잠시만 기다려 주세요.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
