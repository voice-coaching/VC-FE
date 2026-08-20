"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError, api } from "@/lib/api";

const PROTECTED_PREFIXES = [
  "/home",
  "/onboarding",
  "/news",
  "/sentences",
  "/announcer",
  "/class",
  "/practice",
  "/mypage",
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
  const [status, setStatus] = useState<"checking" | "ready" | "error">(
    protectedPath ? "checking" : "ready",
  );
  const [message, setMessage] = useState("");
  const [checkedPath, setCheckedPath] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!protectedPath) return;

    let active = true;
    setStatus("checking");
    setMessage("");
    setCheckedPath(null);
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
        if (onboardingCompleted && pathname === "/onboarding") {
          router.replace("/home");
          return;
        }
        if (!onboardingCompleted && pathname !== "/onboarding") {
          router.replace("/onboarding");
          return;
        }
        setCheckedPath(pathname);
        setStatus("ready");
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          const next = encodeURIComponent(pathname);
          router.replace(`/auth?mode=login&next=${next}`);
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

  if (!protectedPath || (status === "ready" && checkedPath === pathname))
    return children;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      {status === "checking" ? (
        <div role="status">
          <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-border border-t-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            로그인 상태를 확인하는 중…
          </p>
        </div>
      ) : (
        <div>
          <h1 className="text-xl font-bold">서비스에 연결하지 못했어요</h1>
          <p role="alert" className="mt-3 text-sm text-muted-foreground">
            {message}
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-6 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
          >
            다시 시도
          </button>
        </div>
      )}
    </main>
  );
}
