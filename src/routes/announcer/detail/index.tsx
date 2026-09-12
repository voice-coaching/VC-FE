"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import { practiceCopy } from "@/lib/practice-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PracticePlayer } from "@/components/practice-player";
import { IPhoneFrame } from "@/components/iphone-frame";

const DURATION_SECONDS = 42;
const DURATION_MS = DURATION_SECONDS * 1_000;
const SCRIPT = [
  "시청자 여러분 안녕하십니까. 구월 이일 아침 뉴스입니다.",
  "오늘 첫 소식은 한국은행의 기준금리 결정입니다.",
  "자세한 내용 취재기자 연결해 알아보겠습니다.",
];

function formatDuration(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  return `00:${String(totalSeconds).padStart(2, "0")}`;
}

export default function AnnouncerDetailPage() {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{
    position: number;
    id: number;
  }>();
  const [hasSelectedPosition, setHasSelectedPosition] = useState(false);
  const activeSentence = Math.min(
    SCRIPT.length - 1,
    Math.floor(elapsedMs / (DURATION_MS / SCRIPT.length)),
  );

  return (
    <IPhoneFrame>
      <section className="flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" aria-hidden="true" />

        <header className="flex h-12 shrink-0 items-center px-2 py-1">
          <Link
            href="/announcer?preview=1"
            aria-label="아나운서 목록으로 돌아가기"
            className="flex size-10 touch-manipulation items-center justify-center transition-opacity active:opacity-50"
          >
            <NavigationIcon />
          </Link>
          <span className="flex-1" aria-hidden="true" />
          <h1 className="shrink-0 text-[17px] leading-6 font-bold">
            아나운서 따라 읽기
          </h1>
          <span className="flex-1" aria-hidden="true" />
          <span className="size-10 shrink-0" aria-hidden="true" />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2.5 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-[#e4f7ee] px-[11px] py-[5px] text-xs leading-4 font-bold tracking-[0.0252em] text-[#0e8a5f]">
              초급
            </span>
            <span className="rounded-full bg-[#f2f4f6] px-[11px] py-[5px] text-xs leading-4 font-bold tracking-[0.0252em] text-[#4e5968]">
              3문장
            </span>
            <span className="rounded-full bg-[#f2f4f6] px-[11px] py-[5px] text-xs leading-4 font-bold tracking-[0.0252em] text-[#4e5968]">
              00:42
            </span>
          </div>

          <h2 className="mt-2 text-[22px] leading-[30px] font-bold tracking-[-0.0194em]">
            아침 뉴스 오프닝 멘트
          </h2>

          <div className="mt-3.5">
            <PracticePlayer
              duration={DURATION_SECONDS}
              seekRequest={seekRequest}
              onPlayingChange={setIsPlaying}
              onPositionChange={(position) => {
                setElapsedMs(position * 1000);
                setHasSelectedPosition(true);
              }}
            />
          </div>

          <div className="mt-3.5 flex items-center pt-1">
            <h3 className="text-[15px] leading-[22px] font-bold tracking-[0.0096em]">
              스크립트
            </h3>
            <span className="flex-1" />
            {isPlaying ? (
              <p className="text-xs leading-4 font-medium tracking-[0.0252em] text-[#2f6bff]">
                재생 위치를 따라가요
              </p>
            ) : null}
          </div>

          <section className="mt-3.5 flex flex-col gap-1 rounded-2xl bg-white p-3 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
            {SCRIPT.map((sentence, index) => {
              const active =
                (isPlaying || hasSelectedPosition) && activeSentence === index;
              return (
                <button
                  type="button"
                  key={sentence}
                  onClick={() => {
                    const sentenceStart = index * (DURATION_MS / SCRIPT.length);
                    setElapsedMs(sentenceStart);
                    setHasSelectedPosition(true);
                    setSeekRequest((current) => ({
                      position: sentenceStart / 1000,
                      id: (current?.id ?? 0) + 1,
                    }));
                  }}
                  className="relative isolate flex w-full touch-manipulation items-start gap-2.5 overflow-hidden rounded-xl px-2.5 py-3 text-left transition-transform duration-150 ease-out active:scale-[0.988]"
                  aria-label={`${index + 1}번 문장, ${formatDuration(index * (DURATION_MS / SCRIPT.length))}부터 듣기`}
                  aria-pressed={active}
                >
                  <span
                    className={`pointer-events-none absolute inset-0 -z-10 rounded-xl bg-[#edf2ff] transition-[opacity,transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      active
                        ? "scale-100 opacity-100"
                        : "scale-[0.985] opacity-0"
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`shrink-0 text-xs leading-4 font-medium tracking-[0.0252em] transition-colors duration-300 ease-out ${
                      active ? "text-[#2f6bff]" : "text-[#b0b8c1]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <p
                    className={`min-w-0 flex-1 text-[15px] leading-[22px] tracking-[0.0096em] transition-[color,transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      active
                        ? "translate-x-0.5 font-bold text-[#191f28]"
                        : "translate-x-0 font-normal text-[#4e5968]"
                    }`}
                  >
                    {sentence}
                  </p>
                </button>
              );
            })}
          </section>
        </main>

        <div className="h-px shrink-0 bg-[#e5e8eb]" />
        <footer className="shrink-0 bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              const preview =
                process.env.NODE_ENV === "development" &&
                new URLSearchParams(window.location.search).get("preview") ===
                  "1";
              router.push(
                `/announcer/morning-news/record${preview ? "?preview=1" : ""}`,
              );
            }}
            className="flex h-14 w-full touch-manipulation items-center justify-center rounded-full bg-[#2f6bff] px-7 text-base leading-6 font-bold tracking-[0.0057em] text-white transition-transform active:scale-[0.985] active:bg-[#1f55e0]"
          >
            {practiceCopy.recordScreen}
          </button>
        </footer>
        <div className="h-6 shrink-0 bg-white" aria-hidden="true" />
      </section>
    </IPhoneFrame>
  );
}
