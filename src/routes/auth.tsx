"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { api, type SocialProvider } from "@/lib/api";
import { safeInternalPath } from "@/lib/navigation";
import {
  clearOAuthAttempt,
  createOAuthAttempt,
  getOAuthAuthorizationUrl,
  isOAuthProviderConfigured,
} from "@/lib/oauth";

const SNS = [
  {
    provider: "KAKAO",
    label: "카카오",
    cls: "bg-warning text-warning-foreground",
  },
  {
    provider: "GOOGLE",
    label: "Google",
    cls: "border border-border bg-background text-foreground",
  },
  {
    provider: "NAVER",
    label: "네이버",
    cls: "bg-success text-success-foreground",
  },
] satisfies Array<{ provider: SocialProvider; label: string; cls: string }>;

const CONFIGURED_SNS = SNS.filter(({ provider }) =>
  isOAuthProviderConfigured(provider),
);

export default function Auth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signup" | "login">(() =>
    searchParams.get("mode") === "login" ? "login" : "signup",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "checking" | "available" | "used"
  >("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oauthStarted = useRef(false);
  const emailCheckId = useRef(0);
  const returnTo = safeInternalPath(searchParams.get("next"), "/home");
  const passwordValid =
    password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  const startOAuth = useCallback(
    (provider: SocialProvider) => {
      const attempt = createOAuthAttempt(provider, returnTo);
      const authorizationUrl = getOAuthAuthorizationUrl(provider, attempt);
      window.location.assign(authorizationUrl);
    },
    [returnTo],
  );

  useEffect(() => {
    const provider = searchParams.get("provider")?.toUpperCase();
    const requestedProvider = SNS.find((item) => item.provider === provider);
    if (oauthStarted.current || !requestedProvider) return;

    oauthStarted.current = true;
    if (!CONFIGURED_SNS.includes(requestedProvider)) {
      setError(`${requestedProvider.label} OAuth 설정이 없습니다.`);
      return;
    }
    setSubmitting(true);
    try {
      startOAuth(provider as SocialProvider);
    } catch (reason) {
      clearOAuthAttempt(provider as SocialProvider);
      setError(
        reason instanceof Error ? reason.message : "SNS 로그인에 실패했습니다.",
      );
      setSubmitting(false);
    }
  }, [searchParams, startOAuth]);

  async function checkEmail() {
    const candidate = email.trim();
    if (!candidate) return false;
    const requestId = ++emailCheckId.current;
    setEmailStatus("checking");
    setError(null);
    try {
      const result = await api.auth.checkEmail(candidate);
      if (requestId !== emailCheckId.current) return false;
      setEmailStatus(result.available ? "available" : "used");
      if (!result.available) setError("이미 가입된 이메일입니다.");
      return result.available;
    } catch (reason) {
      if (requestId !== emailCheckId.current) return false;
      setEmailStatus("idle");
      setError(
        reason instanceof Error
          ? reason.message
          : "이메일 사용 가능 여부를 확인하지 못했습니다.",
      );
      return false;
    }
  }

  return (
    <AppShell nav={false}>
      <TopBar to="/" title={mode === "signup" ? "회원가입" : "로그인"} />
      <form
        className="flex flex-col gap-6 px-6 pt-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (mode === "signup" && emailStatus !== "available") {
            const available = await checkEmail();
            if (!available) return;
          }
          if (
            mode === "signup" &&
            (!passwordValid ||
              !nickname.trim() ||
              !termsAccepted ||
              emailStatus === "used")
          )
            return;
          setSubmitting(true);
          setError(null);
          try {
            const session =
              mode === "signup"
                ? await api.auth.signUp({
                    email: email.trim(),
                    password,
                    nickname: nickname.trim(),
                    termsAgreed: termsAccepted,
                    privacyAgreed: termsAccepted,
                  })
                : await api.auth.signIn({ email: email.trim(), password });
            router.replace(
              session.onboardingRequired ? "/onboarding" : returnTo,
            );
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : "로그인 요청에 실패했습니다.",
            );
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <h1 className="text-3xl leading-tight font-bold tracking-tight">
          {mode === "signup"
            ? "또박에 오신 걸\n환영해요"
            : "다시 만나서\n반가워요"}
        </h1>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="auth-email"
              className="text-xs font-medium text-muted-foreground"
            >
              이메일
            </label>
            <div className="flex gap-2">
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  emailCheckId.current += 1;
                  setEmail(e.target.value);
                  setEmailStatus("idle");
                  setError(null);
                }}
                onBlur={() => {
                  if (mode === "signup") void checkEmail();
                }}
                placeholder="name@email.com"
                autoComplete="email"
                className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              {mode === "signup" && (
                <button
                  type="button"
                  disabled={!email.trim() || emailStatus === "checking"}
                  onClick={() => void checkEmail()}
                  className="shrink-0 rounded-2xl border border-border px-4 text-xs font-semibold disabled:opacity-30"
                >
                  중복 확인
                </button>
              )}
            </div>
            {mode === "signup" && emailStatus !== "idle" && (
              <span
                role="status"
                className={`text-[11px] ${emailStatus === "used" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {emailStatus === "checking"
                  ? "중복 확인 중…"
                  : emailStatus === "available"
                    ? "사용 가능한 이메일입니다."
                    : "이미 사용 중인 이메일입니다."}
              </span>
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              비밀번호
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className="rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            {mode === "signup" && password && !passwordValid && (
              <span className="text-[11px] text-destructive">
                영문과 숫자를 포함해 8자 이상 입력해 주세요.
              </span>
            )}
          </label>
          {mode === "signup" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                닉네임
              </span>
              <input
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임을 입력해 주세요"
                className="rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </label>
          )}
          {mode === "signup" && (
            <label className="flex items-start gap-2 rounded-2xl border border-border p-3 text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <b>필수</b> 서비스 이용약관 및 개인정보 처리방침에 동의합니다.
              </span>
            </label>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={
            submitting ||
            emailStatus === "checking" ||
            (mode === "signup" &&
              (!passwordValid ||
                !nickname.trim() ||
                !termsAccepted ||
                emailStatus === "used"))
          }
          className="w-full rounded-full bg-foreground py-4 text-sm font-semibold text-background disabled:opacity-30"
        >
          {submitting
            ? "처리 중…"
            : mode === "signup"
              ? "가입하고 설문 시작"
              : "로그인"}
        </button>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> SNS 계정으로 계속하기
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-2.5">
          {CONFIGURED_SNS.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                setError(null);
                try {
                  startOAuth(s.provider);
                } catch (reason) {
                  clearOAuthAttempt(s.provider);
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "SNS 로그인에 실패했습니다.",
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
              className={`w-full rounded-full py-4 text-sm font-semibold ${s.cls}`}
            >
              {s.label} 계정으로 계속하기
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            const nextMode = mode === "signup" ? "login" : "signup";
            setMode(nextMode);
            const params = new URLSearchParams({ mode: nextMode });
            if (returnTo !== "/home") params.set("next", returnTo);
            router.replace(`/auth?${params.toString()}`, { scroll: false });
          }}
          className="pb-10 text-center text-xs text-muted-foreground underline"
        >
          {mode === "signup"
            ? "이미 계정이 있어요"
            : "계정이 없어요, 가입할래요"}
        </button>
      </form>
    </AppShell>
  );
}
