"use client";

import { Lottie } from "lottie-react";
import { useRouter } from "next/navigation";
import { IPhoneFrame } from "@/components/iphone-frame";
import successCheckAnimation from "@/assets/success-check.json";

export function SignupCompleteScreen() {
  const router = useRouter();

  return (
    <IPhoneFrame>
      <section className="flex h-full flex-col bg-white" aria-label="가입 완료">
        <div className="h-11 shrink-0" aria-hidden="true" />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5">
          <div className="h-[82px] shrink-0" aria-hidden="true" />
          <h1 className="text-[24px] leading-8 font-bold tracking-[-0.552px]">
            반가워요!
            <br />
            회원가입이 완료됐어요
          </h1>
          <p className="mt-2 text-[14px] leading-5 tracking-[0.203px] text-[#4e5968]">
            이제 또박또박 말하는 연습을 시작해 보세요
          </p>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <div className="size-[140px] shrink-0 overflow-hidden">
              <Lottie
                src={successCheckAnimation}
                autoplay
                loop={false}
                aria-hidden="true"
                className="size-full"
              />
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col items-center overflow-hidden px-6 pb-6">
          <button
            type="button"
            onClick={() => router.replace("/onboarding")}
            className="flex h-14 w-full shrink-0 items-center justify-center rounded-full bg-[#2f6bff] px-7 text-[16px] leading-6 font-bold tracking-[0.0912px] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff] focus-visible:ring-offset-2"
          >
            시작하기
          </button>
        </footer>

        <div className="h-[34px] shrink-0" aria-hidden="true" />
      </section>
    </IPhoneFrame>
  );
}
