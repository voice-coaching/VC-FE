"use client";

import Image from "next/image";
import { AnalysisLoadingMessage } from "./analysis-loading-message";

/** The original practice analysis waiting screen, shared by every recording flow. */
export function PracticeAnalysisLoading({
  uploading = false,
  connectionRecovering = false,
  stepProgress = 0,
}: {
  uploading?: boolean;
  connectionRecovering?: boolean;
  stepProgress?: number;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center">
      <div className="flex-1" />
      <div className="size-[169px] shrink-0">
        <Image
          src="/newsBird.webp"
          alt=""
          width={169}
          height={169}
          className="size-full object-contain"
        />
      </div>
      <p className="mt-5 min-h-14 w-full shrink-0 px-5 text-center text-[20px] leading-7 font-bold text-[#191f28]">
        {uploading ? (
          "음성을 보내고 있어요"
        ) : connectionRecovering ? (
          "연결 복구 중이에요. 기존 분석 상태를 다시 확인하고 있어요."
        ) : (
          <AnalysisLoadingMessage />
        )}
      </p>
      <div className="mt-9 w-[225px] rounded-[18px] bg-white px-3 py-2 shadow-[0_3px_5px_rgba(23,23,23,0.05)]">
        {["음성 품질 확인", "텍스트로 변환", "발음과 억양 분석"].map(
          (label, index) => {
            const threshold = index * 33;
            const complete = stepProgress >= threshold + 33;
            const current =
              stepProgress >= threshold &&
              stepProgress < threshold + 33;
            return (
              <div key={label} className="flex h-14 items-center gap-3">
                <span className="relative flex h-14 w-7 shrink-0 items-center justify-center">
                  {index > 0 && (
                    <span
                      className={`absolute top-0 left-[13px] h-5 w-0.5 ${complete || current ? "bg-[#2f6bff]" : "bg-[#e5e8eb]"}`}
                    />
                  )}
                  {index < 2 && (
                    <span
                      className={`absolute bottom-0 left-[13px] h-5 w-0.5 ${complete ? "bg-[#2f6bff]" : "bg-[#e5e8eb]"}`}
                    />
                  )}
                  {complete ? (
                    <span className="z-10 flex size-7 items-center justify-center rounded-full bg-[#2f6bff]">
                      <Image
                        src="/figma/practice/check.svg"
                        alt=""
                        width={16}
                        height={16}
                      />
                    </span>
                  ) : (
                    <Image
                      src={
                        current
                          ? "/figma/practice/dot-active.svg"
                          : "/figma/practice/dot-inactive.svg"
                      }
                      alt=""
                      width={28}
                      height={28}
                      className="z-10"
                    />
                  )}
                </span>
                <span
                  className={`text-[15px] leading-[22px] ${current ? "font-bold text-[#143498]" : complete ? "font-medium text-[#4e5968]" : "text-[#b0b8c1]"}`}
                >
                  {label}
                </span>
              </div>
            );
          },
        )}
      </div>
      <div className="flex-1" />
    </div>
  );
}
