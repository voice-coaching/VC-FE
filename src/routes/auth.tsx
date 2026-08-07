"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { api, type SocialProvider } from "@/lib/api";

const SNS = [
  { provider: "kakao", label: "카카오", cls: "bg-warning text-warning-foreground" },
  {
    provider: "google",
    label: "Google",
    cls: "border border-border bg-background text-foreground",
  },
  { provider: "naver", label: "네이버", cls: "bg-success text-success-foreground" },
] satisfies Array<{ provider: SocialProvider; label: string; cls: string }>;

export default function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "used">(
    "idle",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordValid = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  async function checkEmail() {
    if (!email) return;
    setEmailStatus("checking");
    try {
      const result = await api.auth.checkEmail(email);
      setEmailStatus(result.available ? "available" : "used");
    } catch {
      setEmailStatus("idle");
    }
  }

  return (
    <AppShell nav={false}>
      <TopBar to="/" title={mode === "signup" ? "회원가입" : "로그인"} />
      <form
        className="flex flex-col gap-6 px-6 pt-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (mode === "signup" && (!passwordValid || !termsAccepted || emailStatus === "used"))
            return;
          setSubmitting(true);
          setError(null);
          try {
            const session =
              mode === "signup"
                ? await api.auth.signUp({
                    email,
                    password,
                    nickname: nickname.trim() || "또박이",
                    requiredTermsAccepted: termsAccepted,
                  })
                : await api.auth.signIn({ email, password });
            router.push(session.user.onboardingCompleted ? "/home" : "/onboarding");
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "로그인 요청에 실패했습니다.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <h1 className="text-3xl leading-tight font-bold tracking-tight">
          {mode === "signup" ? "또박에 오신 걸\n환영해요" : "다시 만나서\n반가워요"}
        </h1>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">이메일</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailStatus("idle");
              }}
              onBlur={() => {
                if (mode === "signup") void checkEmail();
              }}
              placeholder="name@email.com"
              className="rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            {mode === "signup" && emailStatus !== "idle" && (
              <span
                className={`text-[11px] ${emailStatus === "used" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {emailStatus === "checking"
                  ? "중복 확인 중…"
                  : emailStatus === "available"
                    ? "사용 가능한 이메일입니다."
                    : "이미 사용 중인 이메일입니다."}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">비밀번호</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상"
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
              <span className="text-xs font-medium text-muted-foreground">닉네임</span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="또박이"
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
            (mode === "signup" && (!passwordValid || !termsAccepted || emailStatus === "used"))
          }
          className="w-full rounded-full bg-foreground py-4 text-sm font-semibold text-background disabled:opacity-30"
        >
          {submitting ? "처리 중…" : mode === "signup" ? "가입하고 설문 시작" : "로그인"}
        </button>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> SNS 계정으로 계속하기
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-2.5">
          {SNS.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                setError(null);
                try {
                  const result = await api.auth.socialLogin(s.provider);
                  if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
                  else if (result.session)
                    router.push(result.session.user.onboardingCompleted ? "/home" : "/onboarding");
                } catch (reason) {
                  setError(reason instanceof Error ? reason.message : "SNS 로그인에 실패했습니다.");
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
          onClick={() => setMode((m) => (m === "signup" ? "login" : "signup"))}
          className="pb-10 text-center text-xs text-muted-foreground underline"
        >
          {mode === "signup" ? "이미 계정이 있어요" : "계정이 없어요, 가입할래요"}
        </button>
      </form>
    </AppShell>
  );
}
