"use client";

import { LogIn, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api, type SocialProvider } from "@/lib/api";
import { safeInternalPath } from "@/lib/navigation";
import { redirectToOAuthProvider } from "@/lib/oauth";

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
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const [developerSubmitting, setDeveloperSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unlockClicks = useRef(0);
  const emailInput = useRef<HTMLInputElement>(null);
  const destination = safeInternalPath(returnTo, "/home");
  const submitting = oauthProvider !== null || developerSubmitting;

  useEffect(() => {
    if (developerUnlocked) emailInput.current?.focus();
  }, [developerUnlocked]);

  const startOAuth = useCallback(
    (provider: SocialProvider) => {
      setOAuthProvider(provider);
      setError(null);
      try {
        redirectToOAuthProvider(provider, destination);
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

  function handleUnlockClick() {
    unlockClicks.current += 1;
    if (unlockClicks.current < DEVELOPER_UNLOCK_COUNT) return;
    unlockClicks.current = 0;
    setDeveloperUnlocked(true);
    setError(null);
  }

  async function signInAsDeveloper(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeveloperSubmitting(true);
    setError(null);
    try {
      const session = await api.auth.signIn({
        email: email.trim(),
        password,
      });
      router.replace(session.onboardingRequired ? "/onboarding" : destination);
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

  return (
    <section aria-labelledby="login-methods-heading">
      <h2
        id="login-methods-heading"
        className="text-center text-xs font-medium text-muted-foreground"
      >
        <button
          type="button"
          aria-expanded={developerUnlocked}
          aria-controls="developer-login"
          onClick={handleUnlockClick}
          className="cursor-default select-none rounded-sm px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          로그인 방법
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

      {developerUnlocked && (
        <form
          id="developer-login"
          className="mt-6 border-t border-border pt-5"
          onSubmit={signInAsDeveloper}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">개발자 로그인</h3>
            <button
              type="button"
              aria-label="개발자 로그인 닫기"
              onClick={() => {
                setDeveloperUnlocked(false);
                setEmail("");
                setPassword("");
                setError(null);
              }}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            <label className="sr-only" htmlFor="developer-email">
              개발자 이메일
            </label>
            <input
              ref={emailInput}
              id="developer-email"
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              placeholder="개발자 이메일"
              autoComplete="username"
              className="rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            <label className="sr-only" htmlFor="developer-password">
              개발자 비밀번호
            </label>
            <input
              id="developer-password"
              type="password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              placeholder="개발자 비밀번호"
              autoComplete="current-password"
              className="rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={submitting || !email.trim() || !password}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-sm font-semibold text-background disabled:opacity-40"
            >
              <LogIn className="size-4" />
              {developerSubmitting ? "로그인 중…" : "개발자 로그인"}
            </button>
          </div>
        </form>
      )}

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
