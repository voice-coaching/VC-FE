"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import { practiceCopy } from "@/lib/practice-copy";

import { useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { AnnouncerRecordingReview } from "@/components/announcer-recording-review";
import { usePrototypeRecorder } from "@/hooks/use-prototype-recorder";
import { NewsPlayer } from "@/routes/news/player";
import transition from "./prototype-analysis-flow.module.css";

const button =
  "min-h-14 w-full rounded-full bg-[#2f6bff] px-4 font-bold text-white transition-transform active:scale-[0.98]";

/** An isolated retry keeps the original full recording and result untouched. */
export function FocusedSentencePractice({
  sentence,
  index,
  onBack,
  onComplete,
  mode = "custom",
}: {
  sentence: string;
  index: number;
  onBack: () => void;
  onComplete: () => void;
  mode?: "custom" | "news" | "announcer";
}) {
  const [phase, setPhase] = useState<"listen" | "record" | "review">("listen");
  const [confirm, setConfirm] = useState<"exit" | "retry" | null>(null);
  const duration = Math.max(3, Math.ceil(sentence.length / 5));
  const recorder = usePrototypeRecorder(duration * 1000);
  const recording = recorder.status === "recording";
  const guidance =
    mode === "announcer"
      ? "예시의 속도와 억양을 따라 읽어요"
      : mode === "news"
        ? "정보를 또렷하게, 한 호흡씩 읽어요"
        : "문장 끝까지 일정한 속도로 읽어요";
  const back = () => {
    if (recording || recorder.blob) setConfirm("exit");
    else if (phase === "record") setPhase("listen");
    else onBack();
  };
  return (
    <IPhoneFrame>
      <section className="relative flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" />
        <header className="relative flex h-12 shrink-0 items-center justify-center">
          <button
            aria-label="전체 결과로 돌아가기"
            onClick={back}
            className="absolute left-2 flex size-11 items-center justify-center"
          >
            <NavigationIcon />
          </button>
          <h1 className="text-[17px] font-bold">한 문장 집중 연습</h1>
        </header>
        <main
          key={phase}
          className={`${transition.enter} min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-4 pb-6`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="rounded-full bg-[#edf2ff] px-3 py-1.5 font-bold text-[#143498]">
              {index + 1}번 문장
            </span>
            <span className="text-[#8b95a1]">이번에는 한 문장만</span>
          </div>
          <h2 className="text-xl font-bold">
            {phase === "review" ? "같은 문장을 한 번 더 읽었어요" : guidance}
          </h2>
          <p className="rounded-2xl bg-white p-5 text-base leading-7 shadow-sm">
            {sentence}
          </p>
          {phase === "listen" && (
            <>
              <NewsPlayer duration={duration} />
              <p className="text-sm leading-6 text-[#4e5968]">
                {mode === "announcer"
                  ? "아나운서의 끊어 읽기와 문장 끝 높낮이에 집중해 보세요."
                  : mode === "news"
                    ? "숫자와 핵심 단어를 확인하고, 긴 문장은 호흡을 나누어 읽어 보세요."
                    : "예시의 속도와 문장 끝을 확인한 뒤, 이 문장만 다시 읽어 보세요."}
              </p>
            </>
          )}
          {phase === "review" && recorder.blob && recorder.previewUrl && (
            <>
              <AnnouncerRecordingReview
                blob={recorder.blob}
                url={recorder.previewUrl}
                durationMs={recorder.durationMs}
              />
              <div className="rounded-xl bg-[#edf2ff] p-4 text-sm leading-6 text-[#3659ad]">
                {mode === "announcer"
                  ? "예시처럼 속도와 문장 끝 높낮이를 따라 읽었는지 확인해 보세요."
                  : mode === "news"
                    ? "핵심 정보를 또렷하게 전달하고, 문장 사이에 충분히 쉬었는지 확인해 보세요."
                    : "마지막 단어까지 일정한 속도로 읽었는지 확인해 보세요."}{" "}
                전체 결과로 돌아가 다른 문장도 연습할 수 있어요.
              </div>
            </>
          )}
          <p className="text-xs leading-5 text-[#8b95a1]">
            기존 전체 녹음과 분석 결과는 그대로 유지돼요.
          </p>
        </main>
        <footer className="shrink-0 space-y-3 border-t border-[#e5e8eb] bg-white px-5 pt-4 pb-9">
          {phase === "listen" ? (
            <button className={button} onClick={() => setPhase("record")}>
              {practiceCopy.focusPractice}
            </button>
          ) : phase === "record" ? (
            <>
              <p
                aria-live="polite"
                className="text-center text-sm text-[#4e5968]"
              >
                {recording
                  ? `녹음 중 · ${Math.floor(recorder.elapsedMs / 1000)}초`
                  : "마이크를 누르면 녹음이 시작돼요"}
              </p>
              <button
                className={button}
                onClick={() => {
                  if (recording) {
                    recorder.stop();
                    setPhase("review");
                  } else recorder.start();
                }}
              >
                {recording ? "녹음 마치기" : "마이크 켜고 녹음 시작"}
              </button>
            </>
          ) : (
            <>
              <button className={button} onClick={onComplete}>
                연습 완료 · 전체 결과로
              </button>
              <button
                className="min-h-11 w-full text-sm font-bold text-[#4e5968]"
                onClick={() => setConfirm("retry")}
              >
                이 문장 다시 녹음
              </button>
            </>
          )}
        </footer>
        {confirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 p-6">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="focused-discard-title"
              className="w-full rounded-2xl bg-white p-6 shadow-xl"
            >
              <h2 id="focused-discard-title" className="text-lg font-bold">
                {confirm === "exit"
                  ? "이번 녹음을 버리고 나갈까요?"
                  : "이번 녹음을 지우고 다시 읽을까요?"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#4e5968]">
                집중 연습 녹음만 사라져요. 기존 전체 녹음과 결과는 유지됩니다.
              </p>
              <button
                autoFocus
                onClick={() => setConfirm(null)}
                className={`${button} mt-5`}
              >
                계속 연습
              </button>
              <button
                className="mt-2 min-h-11 w-full text-sm text-[#4e5968]"
                onClick={() => {
                  recorder.reset();
                  if (confirm === "exit") onBack();
                  else setPhase("record");
                  setConfirm(null);
                }}
              >
                {confirm === "exit"
                  ? "이번 녹음 버리고 나가기"
                  : "지우고 다시 녹음"}
              </button>
            </div>
          </div>
        )}
      </section>
    </IPhoneFrame>
  );
}
