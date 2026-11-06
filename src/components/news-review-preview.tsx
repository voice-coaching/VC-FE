"use client";

import Image from "next/image";
import { PracticeAnalysisLoading } from "./practice-analysis-loading";
import { PracticeAnalysisFailure } from "./practice-analysis-failure";
import styles from "./news-review-preview.module.css";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Pause } from "lucide-react";

const time = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function NewsReviewPreview({
  sentences,
  onRestart,
  onTitleChange,
}: {
  sentences: string[];
  onRestart: () => void;
  onTitleChange?: (title: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [single, setSingle] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [analysis, setAnalysis] = useState<"review" | "loading" | "failed">(
    "review",
  );
  const [step, setStep] = useState(0);
  useEffect(() => {
    onTitleChange?.(
      analysis === "loading"
        ? "분석 중"
        : analysis === "failed"
          ? "분석 실패"
          : "연습하기",
    );
    if (analysis !== "loading") return;
    setStep(0);
    const second = setTimeout(() => setStep(33), 1500);
    const third = setTimeout(() => setStep(66), 3000);
    const failure = setTimeout(() => setAnalysis("failed"), 5000);
    return () => {
      clearTimeout(second);
      clearTimeout(third);
      clearTimeout(failure);
    };
  }, [analysis, onTitleChange]);
  // A silent UI timeline only; no microphone, audio upload or analysis request.
  const duration = Math.max(1, sentences.length * 5);
  const active = Math.min(sentences.length - 1, Math.floor(position / 5));
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setPosition((value) => Math.min(value + 0.1, duration)),
      100,
    );
    return () => clearInterval(timer);
  }, [playing, duration]);
  useEffect(() => {
    if (
      position >= duration ||
      (single !== null && position >= (single + 1) * 5)
    )
      setPlaying(false);
  }, [position, duration, single]);
  function toggleAll() {
    setSingle(null);
    if (position >= duration) setPosition(0);
    setPlaying((value) => !value);
  }
  if (analysis === "loading")
    return (
      <div className="flex min-h-full flex-col bg-[#f2f4f6]">
        <PracticeAnalysisLoading stepProgress={step} />
      </div>
    );
  if (analysis === "failed")
    return (
      <div className="flex min-h-full flex-col">
        <PracticeAnalysisFailure
          onRetry={() => setAnalysis("loading")}
          onReturn={() => setAnalysis("review")}
        />
      </div>
    );
  return (
    <div className="flex min-h-full flex-col bg-[#f2f4f6]">
      <div className="px-5 pt-5 pb-6">
        <h2 className="text-[20px] leading-7 font-bold text-[#191f28]">
          녹음을 확인해 주세요
        </h2>
        <p className="mt-2 text-sm leading-5 font-medium text-[#6b7584]">
          문장마다 들어보고 분석을 요청해 주세요
        </p>
        <ol className="mt-5 space-y-0.5 rounded-[20px] bg-white px-2 pt-2 pb-1.5 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
          {sentences.map((sentence, index) => {
            const selected = playing && index === active;
            return (
              <li
                key={index}
                className={`flex items-center gap-2 rounded-[12px] py-3 pr-2 pl-3 ${selected ? "bg-[linear-gradient(90deg,#eee9ff,#edf2ff)]" : ""}`}
              >
                {selected && (
                  <span className="w-[3px] shrink-0 self-stretch rounded-[2px] bg-[linear-gradient(180deg,#7347f2,#5b7bfa)]" />
                )}
                <p
                  className={`min-w-0 flex-1 text-[15px] leading-[22px] [overflow-wrap:anywhere] ${selected ? "font-bold text-[#191f28]" : playing && index > active ? "font-medium text-[#8b95a1]" : "font-medium text-[#333d4b]"}`}
                >
                  {sentence}
                </p>
                <button
                  type="button"
                  aria-label={`${index + 1}문장 ${selected ? "일시정지" : "듣기"}`}
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${selected ? "bg-[#6346f6] text-white" : "bg-[#ece8ff]"}`}
                  onClick={() => {
                    if (selected) setPlaying(false);
                    else {
                      setPosition(index * 5);
                      setSingle(index);
                      setPlaying(true);
                    }
                  }}
                >
                  {selected ? (
                    <Pause size={14} fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Image
                      src="/figma/record-review/play-purple.svg"
                      alt=""
                      width={14}
                      height={14}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-auto px-5 pb-4">
        <div className="flex items-center gap-3 rounded-full bg-white py-2 pr-[18px] pl-2 shadow-[0_2px_8px_rgba(26,33,48,0.06)]">
          <button
            aria-label={playing ? "전체 재생 일시정지" : "전체 듣기"}
            onClick={toggleAll}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6346f6] text-white"
          >
            {playing ? (
              <Pause size={16} fill="currentColor" strokeWidth={0} />
            ) : (
              <Image
                src="/figma/record-review/play-white.svg"
                alt=""
                width={16}
                height={16}
              />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex justify-between gap-2 text-xs leading-4">
              <span
                className={
                  playing ? "font-bold text-[#6346f6]" : "text-[#4e5968]"
                }
              >
                {playing
                  ? single === null
                    ? "전체 듣는 중"
                    : `${active + 1}문장 듣는 중`
                  : "전체 듣기"}
              </span>
              <span className="text-[#6b7684] tabular-nums">
                {time(position)} / {time(duration)}
              </span>
            </div>
            <input
              aria-label="재생 위치"
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={position}
              onChange={(e) => {
                setSingle(null);
                setPosition(Number(e.target.value));
              }}
              className={styles.seek}
              style={{
                background: `linear-gradient(to right, #6346f6 ${(position / duration) * 100}%, #e5e8eb ${(position / duration) * 100}%)`,
              }}
            />
          </div>
        </div>
      </div>
      <div className="border-t border-[#eef0f3] bg-white px-5 pt-3 pb-8">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setPlaying(false);
              setConfirm(true);
            }}
            className="flex h-[52px] items-center justify-center gap-1.5 rounded-full border border-[#e5e8eb] text-[15px] font-bold"
          >
            <Image
              src="/figma/record-review/undo.svg"
              alt=""
              width={18}
              height={18}
            />
            전체 다시 녹음
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setAnalysis("loading");
            }}
            className="h-[52px] rounded-full bg-[#6346f6] text-[15px] font-bold text-white"
          >
            분석 요청
          </button>
        </div>
      </div>
      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-40px)] max-w-[342px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-white px-5 pt-7 pb-5 text-center shadow-xl">
            <Dialog.Title className="text-xl leading-7 font-bold">
              처음부터 다시 녹음할까요?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-5 text-[#6b7684]">
              지금 녹음한 {sentences.length}문장은 지워져요
            </Dialog.Description>
            <div className="mt-6 flex gap-2">
              <button
                onClick={onRestart}
                className="h-14 w-[120px] rounded-full border border-[#e5e8eb] font-bold"
              >
                다시 녹음
              </button>
              <Dialog.Close className="h-14 flex-1 rounded-full bg-[#6346f6] font-bold text-white">
                취소
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
