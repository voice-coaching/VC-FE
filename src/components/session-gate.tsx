"use client";

import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { ApiError, api } from "@/lib/api";
import {
  getAuthSessionSnapshot,
  markAuthenticatedUser,
  resetAuthSession,
} from "@/lib/auth-session";
import { hasAcceptedTerms } from "@/lib/terms-flow";
import { sessionRouteRedirect } from "@/lib/session-route";

const PROTECTED_PREFIXES = [
  "/home",
  "/onboarding",
  "/terms",
  "/news",
  "/sentences",
  "/my-script",
  "/announcer",
  "/class",
  "/practice",
  "/lip-practice",
  "/mypage",
  "/saved",
] as const;

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function SessionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const protectedPath = isProtectedPath(pathname);
  const [status, setStatus] = useState<"checking" | "ready" | "error">(() =>
    protectedPath && getAuthSessionSnapshot().status === "unknown"
      ? "checking"
      : "ready",
  );
  const [message, setMessage] = useState("");
  const [verifiedGeneration, setVerifiedGeneration] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!protectedPath) return;

    const cachedSession = getAuthSessionSnapshot();
    if (cachedSession.status === "anonymous") {
      router.replace("/");
      return;
    }
    if (cachedSession.status === "authenticated") {
      const destination = sessionRouteRedirect(
        pathname,
        cachedSession.onboardingCompleted,
        hasAcceptedTerms(cachedSession.userId),
      );
      if (destination) {
        setStatus("checking");
        router.replace(destination);
        return;
      }
      setStatus("ready");
      return;
    }

    let active = true;
    setStatus("checking");
    setMessage("");
    api.users
      .getMe()
      .then(async (user) => {
        if (!active) return;

        let onboardingCompleted = user.onboardingCompleted;
        if (!onboardingCompleted) {
          try {
            const onboarding = await api.onboarding.get();
            onboardingCompleted = Boolean(onboarding.completedAt);
          } catch (reason) {
            if (!(reason instanceof ApiError && reason.status === 404)) {
              throw reason;
            }
          }
        }

        if (!active) return;
        markAuthenticatedUser({ ...user, onboardingCompleted });
        const destination = sessionRouteRedirect(
          pathname,
          onboardingCompleted,
          hasAcceptedTerms(user.id),
        );
        if (destination) {
          router.replace(destination);
          return;
        }
        setVerifiedGeneration((value) => value + 1);
        setStatus("ready");
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace("/");
          return;
        }
        setMessage(
          reason instanceof Error
            ? reason.message
            : "로그인 상태를 확인하지 못했습니다.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [pathname, protectedPath, retryKey, router]);

  return (
    <>
      <Fragment key={verifiedGeneration}>{children}</Fragment>
      {protectedPath && status === "error" && (
        <div
          role="alert"
          className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[370px] -translate-x-1/2 rounded-2xl bg-[#191f28] p-4 text-sm text-white shadow-lg"
        >
          <p>로그인 상태를 확인하지 못했어요. {message}</p>
          <button
            type="button"
            onClick={() => {
              resetAuthSession();
              setRetryKey((value) => value + 1);
            }}
            className="mt-2 min-h-11 font-semibold text-[#c7baff]"
          >
            다시 확인
          </button>
        </div>
      )}
    </>
  );
}
