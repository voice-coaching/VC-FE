"use client";

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
  const done = !uploading && !connectionRecovering && stepProgress >= 100;
  // The ring shows real progress: a sliver while uploading, then each step.
  const ringProgress = uploading
    ? 18
    : Math.min(100, Math.max(24, stepProgress + 18));
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center">
      <div className="flex-1" />
      {/*
        One ring does both jobs: its arc keeps turning ("working") and grows
        with each analysis step. The bars inside move like a voice being read.
      */}
      <span
        className="analysis-orb relative block size-[140px] shrink-0"
        data-done={done}
        aria-hidden="true"
      >
        <svg viewBox="0 0 140 140" className="absolute inset-0 -rotate-90">
          <defs>
            <linearGradient id="analysis-orb-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8b6cff" />
              <stop offset="100%" stopColor="#5b6ffa" />
            </linearGradient>
          </defs>
          {/* On completion both rings close in onto the disc and become it. */}
          <g
            className="analysis-orb-rings"
            style={{ transformOrigin: "70px 70px" }}
          >
            <circle
              cx="70"
              cy="70"
              r="55"
              fill="none"
              stroke="#ebe7fb"
              strokeWidth="6"
            />
            <circle
              cx="70"
              cy="70"
              r="55"
              fill="none"
              stroke="url(#analysis-orb-grad)"
              strokeWidth="6"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${ringProgress} 100`}
              className="analysis-orb-progress"
              style={{ transformOrigin: "70px 70px" }}
            />
          </g>
        </svg>
        <span className="analysis-orb-core">
          <span className="analysis-orb-bars">
            {[0, 1, 2, 3, 4].map((bar) => (
              <span key={bar} style={{ animationDelay: `${bar * -0.18}s` }} />
            ))}
          </span>
          {/* On completion the bars settle and a check draws in their place. */}
          <svg viewBox="0 0 24 24" className="analysis-orb-check">
            <path
              d="M5 12.5 10 17.5 19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
            />
          </svg>
        </span>
      </span>
      <p
        key={done ? "done" : uploading ? "upload" : "analyze"}
        className="analysis-title mt-6 w-full shrink-0 px-5 text-center text-[20px] leading-7 font-bold text-[#191f28]"
      >
        {done
          ? "분석이 끝났어요"
          : uploading
            ? "음성을 보내고 있어요"
            : connectionRecovering
              ? "연결 복구 중이에요. 기존 분석 상태를 다시 확인하고 있어요."
              : "발음을 분석하고 있어요"}
      </p>
      <div className={`${styles.steps} mt-8`}>
        {["음성 품질 확인", "텍스트로 변환", "발음과 억양 분석"].map(
          (label, index) => {
            const threshold = index * 33;
            const complete = stepProgress >= threshold + 33;
            const current =
              stepProgress >= threshold && stepProgress < threshold + 33;
            return (
              <div
                key={label}
                className="relative flex h-14 items-center gap-[14px] px-4"
              >
                <span className="relative flex h-14 w-7 shrink-0 items-center justify-center">
                  {index < 2 && (
                    <span className={styles.connector} aria-hidden="true">
                      <span
                        className={styles.connectorFill}
                        data-complete={complete}
                      />
                    </span>
                  )}
                  {/* Always mounted so the halo fades in and out instead of popping. */}
                  <span
                    className={styles.pulse}
                    data-active={current}
                    aria-hidden="true"
                  />
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
                {/* Same size in every state; colour and weight ease, so nothing jumps. */}
                <span
                  className={styles.label}
                  data-state={
                    complete ? "complete" : current ? "current" : "waiting"
                  }
                >
                  {label}
                  <span className={styles.ellipsis} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
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
