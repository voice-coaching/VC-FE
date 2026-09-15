"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import type { SocialProvider } from "@/lib/api";
import { redirectToOAuthProvider } from "@/lib/oauth";

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

export function LandingLoginScreen() {
  const [oauthProvider, setOAuthProvider] = useState<SocialProvider | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const startOAuth = useCallback((provider: SocialProvider) => {
    setOAuthProvider(provider);
    setError(null);

    try {
      redirectToOAuthProvider(provider, "/home");
    } catch (reason) {
      setOAuthProvider(null);
      setError(
        reason instanceof Error ? reason.message : "SNS 로그인에 실패했습니다.",
      );
    }
  }, []);

  return (
    <IPhoneFrame>
      <div className="flex h-full flex-col bg-white px-6">
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
          <h2 id="landing-login-methods" className="sr-only">
            로그인 방법
          </h2>

          <div className="flex flex-col gap-2.5">
            {SOCIAL_METHODS.map((method) => (
              <button
                key={method.provider}
                type="button"
                disabled={oauthProvider !== null}
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
