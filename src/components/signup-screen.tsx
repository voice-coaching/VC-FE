"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { TermsScreen } from "@/components/terms-screen";
import { api } from "@/lib/api";
import type { SignupDraft } from "@/lib/terms-flow";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,20}$/;

type FieldStatus = "default" | "focused" | "error" | "success";
type FieldName = "email" | "password" | "passwordConfirm" | "nickname";
type EmailAvailability = "idle" | "checking" | "available" | "unavailable";

export function SignupScreen() {
  const router = useRouter();
  const emailCheckSequence = useRef(0);
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailAvailability, setEmailAvailability] =
    useState<EmailAvailability>("idle");
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordConfirmTouched, setPasswordConfirmTouched] = useState(false);
  const [nickname, setNickname] = useState("");
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<FieldName | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const [visibleStep, setVisibleStep] = useState<1 | 2 | 3 | 4>(1);
  const [signupDraft, setSignupDraft] = useState<SignupDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const normalizedEmail = email.trim();
  const emailFormatValid = EMAIL_PATTERN.test(normalizedEmail);
  const passwordValid = PASSWORD_PATTERN.test(password);
  const passwordsMatch =
    passwordConfirm.length > 0 && passwordConfirm === password;
  const nicknameValid =
    nickname.trim().length > 0 && nickname.trim().length <= 10;

  const emailMessage = getEmailMessage({
    email: normalizedEmail,
    touched: emailTouched,
    formatValid: emailFormatValid,
    availability: emailAvailability,
  });
  const passwordMessage =
    passwordTouched && password.length > 0
      ? passwordValid
        ? { tone: "success" as const, text: "사용할 수 있는 비밀번호예요" }
        : {
            tone: "error" as const,
            text: "영문, 숫자, 특수문자를 포함해 8~20자로 입력해 주세요",
          }
      : null;
  const passwordConfirmMessage =
    passwordConfirmTouched && passwordConfirm.length > 0
      ? passwordsMatch
        ? { tone: "success" as const, text: "비밀번호가 일치해요" }
        : { tone: "error" as const, text: "비밀번호가 일치하지 않아요" }
      : null;
  const nicknameMessage = nicknameError
    ? { tone: "error" as const, text: nicknameError }
    : nicknameTouched && nicknameValid
      ? { tone: "success" as const, text: "사용할 수 있는 닉네임이에요" }
      : null;

  const emailStatus = getFieldStatus(
    focusedField === "email",
    emailMessage?.tone,
  );
  const passwordStatus = getFieldStatus(
    focusedField === "password",
    passwordMessage?.tone,
  );
  const passwordConfirmStatus = getFieldStatus(
    focusedField === "passwordConfirm",
    passwordConfirmMessage?.tone,
  );
  const nicknameStatus = getFieldStatus(
    focusedField === "nickname",
    nicknameMessage?.tone,
  );

  const formValid =
    emailAvailability === "available" &&
    passwordValid &&
    passwordsMatch &&
    nicknameValid &&
    !nicknameError;

  async function checkEmailAvailability() {
    setFocusedField(null);
    setEmailTouched(true);
    if (!emailFormatValid) {
      setEmailAvailability("idle");
      return;
    }

    const requestSequence = ++emailCheckSequence.current;
    setEmailAvailability("checking");

    try {
      const result = await api.auth.checkEmail(normalizedEmail);
      if (requestSequence !== emailCheckSequence.current) return;
      setEmailAvailability(result.available ? "available" : "unavailable");
      setVisibleStep(
        result.available ? (passwordsMatch ? 4 : passwordValid ? 3 : 2) : 1,
      );
    } catch {
      if (requestSequence !== emailCheckSequence.current) return;
      setEmailAvailability("idle");
      setVisibleStep(1);
      setFormError("이메일 중복 확인에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValid) return;
    setSignupDraft({
      email: normalizedEmail,
      password,
      nickname: nickname.trim(),
    });
  }

  if (signupDraft) {
    return (
      <TermsScreen
        signupDraft={signupDraft}
        onBack={() => setSignupDraft(null)}
      />
    );
  }

  return (
    <IPhoneFrame>
      <form
        onSubmit={handleSubmit}
        className="flex h-full flex-col bg-white"
        aria-label="회원가입"
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
            회원가입
          </h1>
          <span className="size-6 shrink-0" aria-hidden="true" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-6">
          <div className="h-[34px] shrink-0" aria-hidden="true" />
          <h2 className="text-[24px] leading-8 font-bold tracking-[-0.552px]">
            가입 정보 입력
          </h2>
          <div className="h-[34px] shrink-0" aria-hidden="true" />

          <TextField
            id="signup-email"
            label="이메일"
            type="email"
            value={email}
            placeholder="이메일을 입력해 주세요"
            autoComplete="username"
            status={emailStatus}
            message={emailMessage}
            onFocus={() => setFocusedField("email")}
            onBlur={() => void checkEmailAvailability()}
            onChange={(value) => {
              emailCheckSequence.current += 1;
              setEmail(value);
              setVisibleStep(1);
              setEmailAvailability("idle");
              setFormError(null);
            }}
            onClear={() => {
              emailCheckSequence.current += 1;
              setEmail("");
              setEmailTouched(false);
              setEmailAvailability("idle");
              setVisibleStep(1);
              setFormError(null);
            }}
          />

          {visibleStep >= 2 && (
            <div className="signup-field-reveal">
              <FieldGap />
              <PasswordField
                id="signup-password"
                label="비밀번호"
                placeholder="비밀번호를 입력해 주세요"
                value={password}
                visible={passwordVisible}
                status={passwordStatus}
                message={passwordMessage}
                onFocus={() => setFocusedField("password")}
                onBlur={() => {
                  setFocusedField(null);
                  setPasswordTouched(true);
                }}
                onChange={(value) => {
                  setPassword(value);
                  if (PASSWORD_PATTERN.test(value)) {
                    setVisibleStep((current) => (current < 3 ? 3 : current));
                  }
                  setFormError(null);
                }}
                onVisibleChange={() =>
                  setPasswordVisible((current) => !current)
                }
              />
            </div>
          )}

          {visibleStep >= 3 && (
            <div className="signup-field-reveal">
              <FieldGap />
              <PasswordField
                id="signup-password-confirm"
                label="비밀번호 확인"
                placeholder="비밀번호를 다시 입력해 주세요"
                value={passwordConfirm}
                visible={passwordConfirmVisible}
                status={passwordConfirmStatus}
                message={passwordConfirmMessage}
                onFocus={() => setFocusedField("passwordConfirm")}
                onBlur={() => {
                  setFocusedField(null);
                  setPasswordConfirmTouched(true);
                }}
                onChange={(value) => {
                  setPasswordConfirm(value);
                  if (value.length > 0 && value === password) {
                    setVisibleStep(4);
                  }
                  setFormError(null);
                }}
                onVisibleChange={() =>
                  setPasswordConfirmVisible((current) => !current)
                }
              />
            </div>
          )}

          {visibleStep >= 4 && (
            <div className="signup-field-reveal">
              <FieldGap />
              <TextField
                id="signup-nickname"
                label="닉네임"
                type="text"
                value={nickname}
                placeholder="닉네임을 입력해 주세요"
                autoComplete="nickname"
                maxLength={10}
                suffix={`${nickname.length}/10`}
                status={nicknameStatus}
                message={nicknameMessage}
                onFocus={() => setFocusedField("nickname")}
                onBlur={() => {
                  setFocusedField(null);
                  setNicknameTouched(true);
                }}
                onChange={(value) => {
                  setNickname(value);
                  setNicknameError(null);
                  setFormError(null);
                }}
                onClear={() => {
                  setNickname("");
                  setNicknameTouched(false);
                  setNicknameError(null);
                  setFormError(null);
                }}
              />
            </div>
          )}

          {formError && (
            <p
              role="alert"
              className="mt-3 text-center text-[12px] leading-[18px] text-[#d22030]"
            >
              {formError}
            </p>
          )}

          <div className="min-h-0 flex-1" />

          <button
            type="submit"
            disabled={!formValid}
            className="flex h-14 w-full shrink-0 items-center justify-center rounded-full bg-[#2f6bff] px-7 text-[17px] leading-6 font-bold text-white transition-colors disabled:bg-[#f2f4f6] disabled:text-[#b0b8c1]"
          >
            회원가입
          </button>
          <div className="h-6 shrink-0" aria-hidden="true" />
        </div>

        <div className="h-[34px] shrink-0" aria-hidden="true" />
      </form>
    </IPhoneFrame>
  );
}

function TextField({
  id,
  label,
  type,
  value,
  placeholder,
  autoComplete,
  maxLength,
  suffix,
  status,
  message,
  onFocus,
  onBlur,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  type: "email" | "text";
  value: string;
  placeholder: string;
  autoComplete: string;
  maxLength?: number;
  suffix?: string;
  status: FieldStatus;
  message: ValidationMessage | null;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <div className="flex h-[30px] items-center gap-2">
        <input
          id={id}
          type={type}
          required
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={status === "error"}
          aria-describedby={message ? `${id}-message` : undefined}
          className={FIELD_INPUT_CLASS}
        />
        {value.length > 0 && (
          <button
            type="button"
            aria-label={`${label} 지우기`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClear}
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
        {suffix && (
          <span className="shrink-0 text-[13px] leading-[18px] tracking-[0.2522px] text-[#8b95a1]">
            <span className={value ? "text-[#4e5968]" : undefined}>
              {value.length}
            </span>
            /10
          </span>
        )}
      </div>
      <FieldUnderline status={status} />
      <FieldMessage id={`${id}-message`} message={message} />
    </div>
  );
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  visible,
  status,
  message,
  onFocus,
  onBlur,
  onChange,
  onVisibleChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  visible: boolean;
  status: FieldStatus;
  message: ValidationMessage | null;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (value: string) => void;
  onVisibleChange: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <div className="relative flex h-[30px] items-center gap-2">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          maxLength={20}
          aria-invalid={status === "error"}
          aria-describedby={message ? `${id}-message` : undefined}
          className={`relative z-10 ${FIELD_INPUT_CLASS} ${
            visible ? "text-[#191f28]" : "text-transparent caret-transparent"
          }`}
        />
        {!visible && (value.length > 0 || status === "focused") && (
          <span
            className="pointer-events-none absolute top-1/2 left-0 flex max-w-[310px] -translate-y-1/2 items-center gap-1 overflow-hidden"
            aria-hidden="true"
          >
            {Array.from(value.slice(0, 16)).map((_, index) => (
              <span
                key={index}
                className="size-[15px] shrink-0 rounded-full bg-[#191f28]"
              />
            ))}
            {status === "focused" && (
              <span className="password-mask-caret h-[22px] w-[1.5px] shrink-0 bg-[#191f28]" />
            )}
          </span>
        )}
        <button
          type="button"
          aria-label={visible ? `${label} 숨기기` : `${label} 보기`}
          aria-pressed={visible}
          onClick={onVisibleChange}
          className="relative z-20 flex size-5 shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]"
        >
          <Image
            src={
              visible
                ? "/figma/auth/password-toggle-hidden.svg"
                : "/figma/auth/password-toggle.svg"
            }
            alt=""
            width={20}
            height={20}
            aria-hidden="true"
          />
        </button>
      </div>
      <FieldUnderline status={status} />
      <FieldMessage id={`${id}-message`} message={message} />
    </div>
  );
}

type ValidationMessage = {
  tone: "error" | "success";
  text: string;
};

function FieldMessage({
  id,
  message,
}: {
  id: string;
  message: ValidationMessage | null;
}) {
  if (!message) return null;

  const success = message.tone === "success";
  return (
    <p
      id={id}
      role={success ? "status" : "alert"}
      className={`flex w-full items-center gap-[5px] text-[13px] leading-[18px] font-normal tracking-[0.2522px] ${
        success ? "text-[#027648]" : "text-[#d22030]"
      }`}
    >
      <Image
        src={
          success
            ? "/figma/auth/circle-check.svg"
            : "/figma/auth/circle-exclamation.svg"
        }
        alt=""
        width={15}
        height={15}
        aria-hidden="true"
        className="size-[15px] shrink-0"
      />
      {message.text}
    </p>
  );
}

function FieldUnderline({ status }: { status: FieldStatus }) {
  const className =
    status === "error"
      ? "h-0.5 bg-[#d22030]"
      : status === "success"
        ? "h-0.5 bg-[#028450]"
        : status === "focused"
          ? "h-0.5 bg-[#2f6bff]"
          : "h-px bg-[#e5e8eb]";

  return <span className={`w-full transition-colors ${className}`} />;
}

function FieldGap() {
  return <div className="h-[26px] shrink-0" aria-hidden="true" />;
}

function getFieldStatus(
  focused: boolean,
  tone?: ValidationMessage["tone"],
): FieldStatus {
  if (tone === "error") return "error";
  if (tone === "success") return "success";
  return focused ? "focused" : "default";
}

function getEmailMessage({
  email,
  touched,
  formatValid,
  availability,
}: {
  email: string;
  touched: boolean;
  formatValid: boolean;
  availability: EmailAvailability;
}): ValidationMessage | null {
  if (touched && email && !formatValid) {
    return { tone: "error", text: "이메일 형식이 올바르지 않아요" };
  }
  if (availability === "unavailable") {
    return {
      tone: "error",
      text: "이미 가입된 이메일이에요. 로그인해 주세요",
    };
  }
  if (availability === "available") {
    return { tone: "success", text: "사용할 수 있는 이메일이에요" };
  }
  return null;
}

const FIELD_LABEL_CLASS =
  "text-[13px] leading-[18px] font-normal tracking-[0.2522px] text-[#4e5968]";
const FIELD_INPUT_CLASS =
  "h-[30px] min-w-0 flex-1 border-0 bg-transparent p-0 text-[17px] leading-6 font-normal text-[#191f28] outline-none placeholder:text-[#8b95a1]";
