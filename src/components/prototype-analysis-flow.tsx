"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { IPhoneFrame } from "./iphone-frame";
import styles from "./prototype-analysis-flow.module.css";

const STEPS = ["음성 품질 확인", "텍스트로 변환", "발음과 억양 분석"];

export function PrototypeAnalysisFlow({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState(-1);
  const completion = useRef(onComplete);
  useEffect(() => {
    completion.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    const timers = [2200, 4400, 7000, 10000].map((delay, index) =>
      setTimeout(() => setStage(index), delay),
    );
    timers.push(setTimeout(() => completion.current(), 10600));
    return () => timers.forEach(clearTimeout);
  }, []);
  const sending = stage === -1;
  const complete = stage === 3;
  return (
    <IPhoneFrame>
      <section className="relative flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" />
        <header className="relative flex h-12 shrink-0 items-center justify-center">
          {sending && (
            <button
              onClick={onBack}
              aria-label="전송 취소하고 녹음 확인으로 돌아가기"
              className="absolute left-2 flex size-10 items-center justify-center active:opacity-50"
            >
              <NavigationIcon />
            </button>
          )}
          <h1 className="text-[17px] leading-6 font-bold">
            {sending ? "연습하기" : complete ? "분석 완료" : "분석 중"}
          </h1>
        </header>
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">
          <div key={sending ? "sending" : "analysis"} className={styles.enter}>
            <div
              className="flex flex-col items-center gap-5 px-10 text-center"
              role="status"
              aria-live="polite"
            >
              <div
                className={`${styles.hero} ${complete ? styles.settled : ""} relative flex size-[72px] items-center justify-center rounded-full bg-[#edf2ff]`}
              >
                {!complete && (
                  <span aria-hidden="true" className={styles.halo} />
                )}
                <Image
                  src={`/figma/announcer/${sending ? "sending" : "analysis"}.svg`}
                  alt=""
                  width={30}
                  height={30}
                />
              </div>
              <div
                key={complete ? "complete" : "progress"}
                className={styles.copy}
              >
                <h2 className="text-xl leading-7 font-bold tracking-[-0.24px]">
                  {sending
                    ? "녹음을 보내고 있어요"
                    : complete
                      ? "발음 분석이 완료됐어요"
                      : "발음을 분석하고 있어요"}
                </h2>
                <p className="mt-2 text-sm leading-5 text-[#4e5968]">
                  {sending
                    ? "잠시만 기다려 주세요"
                    : complete
                      ? "프로토타입 분석 과정이 끝났어요"
                      : "보통 10초 정도 걸려요"}
                </p>
              </div>
              {sending && (
                <div
                  role="progressbar"
                  aria-label="녹음 전송 중"
                  className="h-2 w-full overflow-hidden rounded-full bg-[#e5e8eb]"
                >
                  <div
                    className={`${styles.progress} h-full origin-left rounded-full bg-[#2f6bff]`}
                  />
                </div>
              )}
            </div>
            {!sending && (
              <ol className="mx-8 mt-9 rounded-[18px] px-3 py-2">
                {STEPS.map((label, index) => {
                  const done = index < stage;
                  const active = index === stage;
                  return (
                    <li
                      key={label}
                      aria-current={active ? "step" : undefined}
                      className={`${styles.step} relative flex h-14 items-center gap-3 pr-2.5 pl-2`}
                      style={{ animationDelay: `${index * 70 + 100}ms` }}
                    >
                      <span
                        aria-hidden="true"
                        className={`${styles.highlight} ${active ? styles.highlightActive : ""}`}
                      />
                      {index < 2 && (
                        <span
                          aria-hidden="true"
                          className="absolute top-7 left-[21px] h-14 w-0.5 bg-[#e5e8eb]"
                        >
                          <span
                            className={styles.connector}
                            style={{ transform: `scaleY(${done ? 1 : 0})` }}
                          />
                        </span>
                      )}
                      <span
                        className={`relative flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ${done ? "bg-[#2f6bff]" : ""}`}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className={styles.activeRing}
                          />
                        )}
                        <span
                          key={done ? "done" : active ? "active" : "pending"}
                          className={`${styles.dot} ${done ? styles.check : ""}`}
                        >
                          <Image
                            src={`/figma/announcer/analysis-${done ? "check" : active ? "active" : "pending"}.svg`}
                            alt=""
                            width={done ? 16 : 28}
                            height={done ? 16 : 28}
                          />
                        </span>
                      </span>
                      <span
                        className={`${styles.label} ${active ? styles.labelActive : ""} text-[15px] font-semibold ${active ? "text-[#143498]" : done ? "text-[#4e5968]" : "text-[#b0b8c1]"}`}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </section>
    </IPhoneFrame>
  );
}
