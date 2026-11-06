"use client";

import Image from "next/image";
import styles from "./practice-analysis-loading.module.css";

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
      <div className="h-[169px] w-[140px] shrink-0">
        <Image
          src="/figma/analysis-screen7/loading.png"
          alt=""
          width={140}
          height={169}
          className="size-full object-contain"
        />
      </div>
      <p className="mt-5 w-full shrink-0 px-5 text-center text-[20px] leading-7 font-bold text-[#191f28]">
        {uploading
          ? "음성을 보내고 있어요"
          : connectionRecovering
            ? "연결 복구 중이에요. 기존 분석 상태를 다시 확인하고 있어요."
            : "발음을 분석하고 있어요"}
      </p>
      <div className="mt-9 pb-2">
        {["음성 품질 확인", "텍스트로 변환", "발음과 억양 분석"].map(
          (label, index) => {
            const threshold = index * 33;
            const complete = stepProgress >= threshold + 33;
            const current =
              stepProgress >= threshold && stepProgress < threshold + 33;
            return (
              <div key={label} className="flex h-14 items-center gap-[14px]">
                <span className="relative flex h-14 w-7 shrink-0 items-center justify-center">
                  {index < 2 && (
                    <span className={styles.connector} aria-hidden="true">
                      <span
                        className={styles.connectorFill}
                        data-complete={complete}
                      />
                    </span>
                  )}
                  {current && (
                    <span className={styles.pulse} aria-hidden="true" />
                  )}
                  <span
                    className={styles.marker}
                    data-state={
                      complete ? "complete" : current ? "current" : "waiting"
                    }
                    aria-hidden="true"
                  >
                    <span className={styles.markerFill} />
                    <span className={styles.markerDot} />
                    <svg
                      className={styles.markerCheck}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M3 8L6.5 11.5L13 5"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pathLength="1"
                      />
                    </svg>
                  </span>
                </span>
                <span
                  className={`transition-colors duration-300 motion-reduce:transition-none text-[15px] leading-[22px] ${current ? "text-base font-bold text-[#191f28]" : complete ? "font-medium text-[#8b95a1]" : "text-[#b0b8c1]"}`}
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
