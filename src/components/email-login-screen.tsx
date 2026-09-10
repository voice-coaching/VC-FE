"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { api } from "@/lib/api";
import { getPostLoginDestination } from "@/lib/terms-flow";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailLoginScreen() {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedEmail = email.trim();
  const emailValid = EMAIL_PATTERN.test(normalizedEmail);
  const emailFormatInvalid =
    emailTouched && normalizedEmail.length > 0 && !emailValid;
  const canSubmit = emailValid && password.length > 0;
  const credentialsEntered = normalizedEmail.length > 0 && password.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailTouched(true);
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const session = await api.auth.signIn({
        email: normalizedEmail,
        password,
      });
      router.replace(getPostLoginDestination(session));
    } catch {
      setError("비밀번호가 일치하지 않아요");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IPhoneFrame>
      <form
        onSubmit={handleSubmit}
        className="flex h-full flex-col bg-white"
        aria-label="이메일 로그인"
      >
        <div className="h-11 shrink-0" aria-hidden="true" />

        <header className="flex h-12 shrink-0 items-center px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="이전 화면으로 돌아가기"
            className="flex size-6 shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]"
          >
            <Image
              src="/figma/auth/chevron-left.svg"
              alt=""
              width={24}
              height={24}
              aria-hidden="true"
            />
          </button>
          <h1 className="flex-1 text-center text-[18px] leading-[26px] font-bold tracking-[-0.0036px]">
            로그인
          </h1>
          <span className="size-6 shrink-0" aria-hidden="true" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-6">
          <div className="h-[34px] shrink-0" aria-hidden="true" />

          <div className="flex flex-col gap-2.5">
            <label
              htmlFor="login-email"
              className="text-[13px] leading-[18px] font-normal tracking-[0.2522px] text-[#4e5968]"
            >
              이메일
            </label>
            <div className="flex h-[30px] items-center gap-2">
              <input
                ref={emailInputRef}
                id="login-email"
                type="text"
                required
                value={email}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                aria-invalid={emailFormatInvalid}
                aria-describedby={
                  emailFormatInvalid ? "login-email-error" : undefined
                }
                placeholder="이메일을 입력해 주세요"
                autoComplete="username"
                inputMode="email"
                className="h-[30px] min-w-0 flex-1 border-0 bg-transparent p-0 text-[17px] leading-6 font-normal text-[#191f28] outline-none placeholder:text-[#8b95a1]"
              />
              {email && (
                <button
                  type="button"
                  aria-label="이메일 지우기"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setEmail("");
                    setEmailTouched(false);
                    setError(null);
                    emailInputRef.current?.focus();
                  }}
                  className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#8b95a1]"
                >
                  <Image
                    src="/figma/auth/input-clear.svg"
                    alt=""
                    width={20}
                    height={20}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
            <span
              className={`w-full transition-colors ${
                emailFormatInvalid
                  ? "h-0.5 bg-[#d22030]"
                  : focusedField === "email"
                    ? "h-0.5 bg-[#2f6bff]"
                    : "h-px bg-[#e5e8eb]"
              }`}
            />
            {emailFormatInvalid && (
              <span
                id="login-email-error"
                role="alert"
                className="flex w-full items-center gap-[5px] text-[13px] leading-[18px] font-normal tracking-[0.2522px] text-[#d22030]"
              >
                <Image
                  src="/figma/auth/circle-exclamation.svg"
                  alt=""
                  width={15}
                  height={15}
                  aria-hidden="true"
                  className="size-[15px] shrink-0"
                />
                이메일 형식이 올바르지 않아요
              </span>
            )}
          </div>

          <div className="h-7 shrink-0" aria-hidden="true" />

          <div className="flex flex-col gap-2.5">
            <label
              htmlFor="login-password"
              className="text-[13px] leading-[18px] font-normal tracking-[0.2522px] text-[#4e5968]"
            >
              비밀번호
            </label>
            <span className="relative flex h-[30px] items-center gap-2">
              <input
                id="login-password"
                type={passwordVisible ? "text" : "password"}
                required
                value={password}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
                placeholder="비밀번호를 입력해 주세요"
                autoComplete="current-password"
                className={`relative z-10 h-[30px] min-w-0 flex-1 border-0 bg-transparent p-0 text-[17px] leading-6 font-normal outline-none placeholder:text-[#8b95a1] ${
                  passwordVisible
                    ? "text-[#191f28]"
                    : "text-transparent caret-transparent"
                }`}
              />
              {!passwordVisible &&
                (password.length > 0 || focusedField === "password") && (
                  <span
                    className="pointer-events-none absolute top-1/2 left-0 flex max-w-[310px] -translate-y-1/2 items-center gap-1 overflow-hidden"
                    aria-hidden="true"
                  >
                    {Array.from(password).map((_, index) => (
                      <span
                        key={index}
                        className="size-[15px] shrink-0 rounded-full bg-[#191f28]"
                      />
                    ))}
                    {focusedField === "password" && (
                      <span className="password-mask-caret h-[22px] w-[1.5px] shrink-0 bg-[#191f28]" />
                    )}
                  </span>
                )}
              <button
                type="button"
                aria-label={
                  passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"
                }
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((visible) => !visible)}
                className="flex size-6 shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]"
              >
                <Image
                  src={
                    passwordVisible
                      ? "/figma/auth/password-toggle-hidden.svg"
                      : "/figma/auth/password-toggle.svg"
                  }
                  alt=""
                  width={24}
                  height={24}
                  aria-hidden="true"
                />
              </button>
            </span>
            <span
              className={`w-full transition-colors ${
                error
                  ? "h-0.5 bg-[#d22030]"
                  : focusedField === "password"
                    ? "h-0.5 bg-[#2f6bff]"
                    : "h-px bg-[#e5e8eb]"
              }`}
            />
            {error && (
              <span
                role="alert"
                className="flex items-center gap-[5px] text-[13px] leading-[18px] font-normal tracking-[0.2522px] text-[#d22030]"
              >
                <Image
                  src="/figma/auth/circle-exclamation.svg"
                  alt=""
                  width={15}
                  height={15}
                  aria-hidden="true"
                  className="size-[15px] shrink-0"
                />
                {error}
              </span>
            )}
          </div>

          <div className="h-[30px] shrink-0" aria-hidden="true" />

          <nav
            aria-label="계정 도움말"
            className="flex items-center justify-center gap-3 text-[15px] leading-[22px] font-medium tracking-[0.144px] text-[#4e5968]"
          >
            <Link href="/signup">회원가입</Link>
            <span className="h-3 w-px bg-[#e5e8eb]" aria-hidden="true" />
            <span>비밀번호 재설정</span>
          </nav>

          <div className="min-h-0 flex-1" />

          <button
            type="submit"
            disabled={!credentialsEntered || submitting}
            className="flex h-14 w-full shrink-0 items-center justify-center rounded-full bg-[#2f6bff] px-7 text-[17px] leading-6 font-bold text-white transition-colors disabled:bg-[#f2f4f6] disabled:text-[#b0b8c1]"
          >
            {submitting ? "로그인 중…" : "로그인"}
          </button>
          <div className="h-6 shrink-0" aria-hidden="true" />
        </div>

        <div className="h-[34px] shrink-0" aria-hidden="true" />
      </form>
    </IPhoneFrame>
  );
}
