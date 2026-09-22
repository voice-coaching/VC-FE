"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { api, type SocialProvider } from "@/lib/api";
import { getAuthSessionSnapshot } from "@/lib/auth-session";
import { redirectToOAuthProvider } from "@/lib/oauth";
import appShellStyles from "./app-shell.module.css";

const SOCIAL_METHODS = [
  {
    provider: "KAKAO",
    label: "카카오로 계속하기",
    icon: "/figma/auth/kakao.svg",
    className: "bg-[#fee500] text-[#191919]",
  },
  {
    provider: "NAVER",
    label: "네이버로 계속하기",
    icon: "/figma/auth/naver.svg",
    className: "bg-[#03c75a] text-white",
  },
  {
    provider: "GOOGLE",
    label: "Google로 계속하기",
    icon: "/figma/auth/google.svg",
    className: "border border-[#dadce0] bg-white text-[#1f1f1f]",
  },
] satisfies Array<{
  provider: SocialProvider;
  label: string;
  icon: string;
  className: string;
}>;

const SPLASH_DURATION_MS = 800;

type EntryPhase = "splash" | "login";

async function hasAuthenticatedSession() {
  const session = getAuthSessionSnapshot();
  if (session.status === "authenticated") return true;
  if (session.status === "anonymous") return false;

  try {
    await api.users.getMe();
    return true;
  } catch {
    return false;
  }
}

export function LandingLoginScreen() {
  const router = useRouter();
  const [entryPhase, setEntryPhase] = useState<EntryPhase>("splash");
  const [oauthProvider, setOAuthProvider] = useState<SocialProvider | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const submitting = oauthProvider !== null;

  useEffect(() => {
    let active = true;
    let splashTimer: number | undefined;

    const minimumSplash = new Promise<void>((resolve) => {
      splashTimer = window.setTimeout(resolve, SPLASH_DURATION_MS);
    });

    void Promise.all([minimumSplash, hasAuthenticatedSession()]).then(
      ([, authenticated]) => {
        if (!active) return;

        if (authenticated) {
          router.prefetch("/home");
          router.replace("/home");
          return;
        }
        setEntryPhase("login");
      },
    );

    return () => {
      active = false;
      if (splashTimer !== undefined) window.clearTimeout(splashTimer);
    };
  }, [router]);

  useEffect(() => {
    const resetPendingOAuth = () => setOAuthProvider(null);
    const resetPendingOAuthWhenVisible = () => {
      if (document.visibilityState === "visible") resetPendingOAuth();
    };

    window.addEventListener("pageshow", resetPendingOAuth);
    document.addEventListener("visibilitychange", resetPendingOAuthWhenVisible);
    return () => {
      window.removeEventListener("pageshow", resetPendingOAuth);
      document.removeEventListener(
        "visibilitychange",
        resetPendingOAuthWhenVisible,
      );
    };
  }, []);

  const startOAuth = useCallback(async (provider: SocialProvider) => {
    setOAuthProvider(provider);
    setError(null);

    try {
      await redirectToOAuthProvider(provider, "/home");
    } catch (reason) {
      setOAuthProvider(null);
      setError(
        reason instanceof Error ? reason.message : "SNS 로그인에 실패했습니다.",
      );
    }
  }, []);

  if (entryPhase !== "login") {
    return (
      <IPhoneFrame backgroundColor="#336fff">
        <div
          role="status"
          aria-label="Speak AI 시작 화면"
          className="flex h-full w-full flex-col bg-[#336fff]"
        >
          <div className="h-11 shrink-0" aria-hidden="true" />
          <div className="flex min-h-0 flex-1 items-center justify-center px-6">
            <Image
              src="/figma/brand/splash-final.svg"
              alt=""
              width={70}
              height={98}
              priority
              aria-hidden="true"
            />
          </div>
          <div className="h-[34px] shrink-0" aria-hidden="true" />
          <span className="sr-only">로딩 중…</span>
        </div>
      </IPhoneFrame>
    );
  }

  return (
    <IPhoneFrame backgroundColor="#ffffff">
      <div
        className={`${appShellStyles.tabContent} ${appShellStyles.fromRight} flex h-full flex-col bg-white`}
      >
        <div className="h-11 shrink-0" aria-hidden="true" />
        <main className="flex min-h-0 flex-1 flex-col px-6">
          <div className="min-h-0 flex-1" aria-hidden="true" />
          <h1 className="flex shrink-0 flex-col items-center gap-4">
            <Image
              src="/figma/brand/s-symbol.svg"
              alt=""
              width={38.6}
              height={54}
              priority
              aria-hidden="true"
            />
            <Image
              src="/figma/brand/wordmark.svg"
              alt="Speak AI"
              width={146}
              height={32}
              priority
            />
          </h1>
          <div className="min-h-0 flex-1" aria-hidden="true" />

          <section aria-label="로그인 옵션" className="flex flex-col gap-2.5">
            {SOCIAL_METHODS.map((method) => (
              <button
                key={method.provider}
                type="button"
                disabled={submitting}
                onClick={() => startOAuth(method.provider)}
                className={`relative flex h-14 w-full shrink-0 items-center justify-center rounded-full px-12 text-[17px] leading-6 font-medium transition-[filter,opacity] active:brightness-[0.97] disabled:opacity-45 ${method.className}`}
              >
                <span className="absolute left-5 top-[18px] flex size-5 items-center justify-center">
                  <Image
                    src={method.icon}
                    alt=""
                    width={20}
                    height={20}
                    aria-hidden="true"
                  />
                </span>
                {oauthProvider === method.provider ? "이동 중…" : method.label}
              </button>
            ))}
          </section>

          {error && (
            <p
              role="alert"
              className="mt-3 text-center text-[12px] leading-4 text-[#d22030]"
            >
              {error}
            </p>
          )}
          <div className="h-5 shrink-0" aria-hidden="true" />
          <div className="h-6 shrink-0" aria-hidden="true" />
        </main>
        <div className="h-[34px] shrink-0" aria-hidden="true" />
      </div>
    </IPhoneFrame>
  );
}
