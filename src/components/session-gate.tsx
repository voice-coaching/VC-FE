"use client";

import { LoadingOverlay } from "@/components/loading-overlay";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
] as const;

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function canOpenPath(pathname: string) {
  const session = getAuthSessionSnapshot();
  if (session.status !== "authenticated") return false;
  return (
    sessionRouteRedirect(
      pathname,
      session.onboardingCompleted,
      hasAcceptedTerms(session.userId),
    ) === null
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

  if (!protectedPath || (status === "ready" && canOpenPath(pathname)))
    return children;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      {status !== "error" ? (
        <LoadingOverlay label="로그인 상태를 확인하는 중…" />
      ) : (
        <div>
          <h1 className="text-xl font-bold">서비스에 연결하지 못했어요</h1>
          <p role="alert" className="mt-3 text-sm text-muted-foreground">
            {message}
          </p>
          <button
            type="button"
            onClick={() => {
              resetAuthSession();
              setRetryKey((value) => value + 1);
            }}
            className="mt-6 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
          >
            다시 시도
          </button>
        </div>
      )}
    </main>
  );
}
