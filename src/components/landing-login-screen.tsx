"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { api, type SocialProvider } from "@/lib/api";
import { getAuthSessionSnapshot } from "@/lib/auth-session";
import { requestDeveloperSession } from "@/lib/developer-login";
import { redirectToOAuthProvider } from "@/lib/oauth";
import { getPostLoginDestination } from "@/lib/terms-flow";
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
    label: "구글로 시작하기",
    icon: "/figma/auth/google.svg",
    className: "border border-[#dadce0] bg-white text-[#1f1f1f]",
  },
] satisfies Array<{
  provider: SocialProvider;
  label: string;
  icon: string;
  className: string;
}>;

const DEVELOPER_UNLOCK_COUNT = 5;
const SPLASH_DURATION_MS = 1_000;

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
  const [developerSubmitting, setDeveloperSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const developerUnlockClicks = useRef(0);
  const submitting = oauthProvider !== null || developerSubmitting;

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

  async function signInAsDeveloper() {
    setDeveloperSubmitting(true);
    setError(null);
    try {
      const session = await requestDeveloperSession();
      router.replace(getPostLoginDestination(session, "/home"));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "개발자 로그인에 실패했습니다.",
      );
    } finally {
      setDeveloperSubmitting(false);
    }
  }

  function handleDeveloperUnlock() {
    developerUnlockClicks.current += 1;
    if (developerUnlockClicks.current < DEVELOPER_UNLOCK_COUNT) return;
    developerUnlockClicks.current = 0;
    void signInAsDeveloper();
  }

  if (entryPhase !== "login") {
    return (
      <IPhoneFrame backgroundColor="#2f6bff">
        <div
          role="status"
          aria-label="SPEAK AI 워드마크 시작 화면"
          className="relative h-full w-full overflow-hidden bg-[#2f6bff]"
        >
          <Image
            src="/figma/auth/01-splash.svg"
            alt="SPEAK AI"
            fill
            priority
            sizes="100vw"
            className="object-contain"
          />
          <div className="absolute top-[61%] left-1/2 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 text-[12px] leading-4 font-semibold whitespace-nowrap text-white backdrop-blur-sm">
            <span
              aria-hidden="true"
              className="size-3 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none"
            />
            로딩 중…
          </div>
        </div>
      </IPhoneFrame>
    );
  }

  return (
    <IPhoneFrame backgroundColor="#ffffff">
      <div
        className={`${appShellStyles.tabContent} ${appShellStyles.fromRight} flex h-full flex-col bg-white px-6`}
      >
        <section className="flex flex-col items-center pt-[172px] text-center">
          <Image
            src="/figma/auth/brand-symbol.svg"
            alt=""
            width={52}
            height={44}
            priority
            aria-hidden="true"
          />
          <h1 className="mt-4 text-[24px] leading-8 font-extrabold tracking-[-0.4px]">
            SPEAK AI
          </h1>
          <p className="mt-2 text-[13px] leading-5 font-medium tracking-[-0.1px] text-[#6b7280]">
            또박또박 말하는 연습
          </p>
        </section>

        <section className="mt-[190px]" aria-labelledby="landing-login-methods">
          <h2
            id="landing-login-methods"
            className="text-center text-[12px] leading-4 font-medium text-[#8b95a1]"
          >
            <button
              type="button"
              disabled={submitting}
              aria-busy={developerSubmitting}
              onClick={handleDeveloperUnlock}
              className="cursor-default select-none rounded-sm px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff] disabled:opacity-60"
            >
              {developerSubmitting ? "개발자 로그인 중…" : "로그인 옵션"}
            </button>
          </h2>

          <div className="mt-3 flex flex-col gap-2.5">
            {SOCIAL_METHODS.map((method) => (
              <button
                key={method.provider}
                type="button"
                disabled={submitting}
                onClick={() => startOAuth(method.provider)}
                className={`relative flex h-[50px] w-full items-center justify-center rounded-full px-12 text-[16px] leading-6 font-bold tracking-[0.0912px] transition-[filter,opacity] active:brightness-[0.97] disabled:opacity-45 ${method.className}`}
              >
                <span className="absolute left-[18px] top-1/2 flex size-5 -translate-y-1/2 items-center justify-center">
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
          </div>

          <p className="mt-6 text-center text-[12px] leading-4 font-medium tracking-[0.15px] text-[#8b95a1]">
            아직 회원이 아니신가요?{" "}
            <Link href="/signup" className="font-semibold text-[#2f6bff]">
              회원가입
            </Link>
          </p>

          {error && (
            <p
              role="alert"
              className="mt-3 text-center text-[12px] leading-4 text-[#d22030]"
            >
              {error}
            </p>
          )}
        </section>
      </div>
    </IPhoneFrame>
  );
}
