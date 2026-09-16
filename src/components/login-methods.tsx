"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SocialProvider } from "@/lib/api";
import { requestDeveloperSession } from "@/lib/developer-login";
import { safeInternalPath } from "@/lib/navigation";
import { redirectToOAuthProvider } from "@/lib/oauth";
import { getPostLoginDestination } from "@/lib/terms-flow";

const SOCIAL_METHODS = [
  {
    provider: "NAVER",
    label: "네이버",
    className: "bg-[#03c75a] text-white",
  },
  {
    provider: "KAKAO",
    label: "카카오",
    className: "bg-[#fee500] text-[#191919]",
  },
  {
    provider: "GOOGLE",
    label: "구글",
    className: "border border-border bg-background text-foreground",
  },
] satisfies Array<{
  provider: SocialProvider;
  label: string;
  className: string;
}>;

const DEVELOPER_UNLOCK_COUNT = 5;

export function LoginMethods({ returnTo = "/home" }: { returnTo?: string }) {
  const router = useRouter();
  const [oauthProvider, setOAuthProvider] = useState<SocialProvider | null>(
    null,
  );
  const [developerSubmitting, setDeveloperSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlockClicks = useRef(0);
  const destination = safeInternalPath(returnTo, "/home");
  const submitting = oauthProvider !== null || developerSubmitting;

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

  const startOAuth = useCallback(
    async (provider: SocialProvider) => {
      setOAuthProvider(provider);
      setError(null);
      try {
        await redirectToOAuthProvider(provider, destination);
      } catch (reason) {
        setOAuthProvider(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "SNS 로그인에 실패했습니다.",
        );
      }
    },
    [destination],
  );

  async function signInAsDeveloper() {
    setDeveloperSubmitting(true);
    setError(null);
    try {
      const session = await requestDeveloperSession();
      router.replace(getPostLoginDestination(session, destination));
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

  function handleUnlockClick() {
    unlockClicks.current += 1;
    if (unlockClicks.current < DEVELOPER_UNLOCK_COUNT) return;
    unlockClicks.current = 0;
    void signInAsDeveloper();
  }

  return (
    <section aria-labelledby="login-methods-heading">
      <h2
        id="login-methods-heading"
        className="text-center text-xs font-medium text-muted-foreground"
      >
        <button
          type="button"
          disabled={submitting}
          aria-busy={developerSubmitting}
          onClick={handleUnlockClick}
          className="cursor-default select-none rounded-sm px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
            className={`w-full rounded-full py-4 text-sm font-semibold transition-opacity disabled:opacity-40 ${method.className}`}
          >
            {oauthProvider === method.provider
              ? `${method.label}로 이동 중…`
              : `${method.label}로 계속하기`}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-center text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </section>
  );
}
