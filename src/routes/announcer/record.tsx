"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import { practiceCopy } from "@/lib/practice-copy";
import { useRouter } from "next/navigation";
import { Mic, Square } from "lucide-react";
import { useState } from "react";
import { PracticeWave } from "@/components/practice-wave";
import { AnnouncerRecordingReview } from "@/components/announcer-recording-review";
import { AnnouncerResult } from "@/components/announcer-result";
import { IPhoneFrame } from "@/components/iphone-frame";
import { usePrototypeRecorder } from "@/hooks/use-prototype-recorder";
import { useSavePracticeCompletion } from "@/hooks/use-prototype-history";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";

const SCRIPT = [
  "시청자 여러분 안녕하십니까. 구월 이일 아침 뉴스입니다.",
  "오늘 첫 소식은 한국은행의 기준금리 결정입니다.",
  "자세한 내용 취재기자 연결해 알아보겠습니다.",
];

export default function AnnouncerRecordPage() {
  const saveCompletion = useSavePracticeCompletion();
  const router = useRouter();
  const recorder = usePrototypeRecorder();
  const [showResult, setShowResult] = useState(false);
  const recording = recorder.status === "recording";
  const recorded = recorder.status === "recorded";
  const guard = useRecordingDiscardGuard(recording || recorded);
  const requesting = recorder.status === "requesting";
  const seconds = Math.floor(recorder.elapsedMs / 1000);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (showResult && recorded && recorder.previewUrl) {
    return (
      <>
        {guard.dialog}
        <AnnouncerResult
          url={recorder.previewUrl}
          durationMs={recorder.durationMs}
          onBack={() => setShowResult(false)}
          onRetry={() =>
            guard.request("retry", () => {
              setShowResult(false);
              recorder.reset();
            })
          }
          onFinish={() => {
            saveCompletion({
              mode: "announcer",
              title: "아침 뉴스 오프닝 멘트",
              sentenceCount: SCRIPT.length,
              daily: false,
            });
            const preview =
              process.env.NODE_ENV === "development" &&
              new URLSearchParams(window.location.search).get("preview") ===
                "1";
            recorder.reset();
            router.push(`/home${preview ? "?preview=1" : ""}`);
          }}
        />
      </>
    );
  }

  return (
    <IPhoneFrame>
      {guard.dialog}
      <section className="flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" />
        <header className="relative flex h-12 shrink-0 items-center justify-center px-2">
          <button
            type="button"
            aria-label="상세 화면으로 돌아가기"
            className="absolute left-2 flex size-10 touch-manipulation items-center justify-center active:opacity-50"
            onClick={() =>
              guard.request("exit", () => {
                recorder.reset();
                const preview =
                  process.env.NODE_ENV === "development" &&
                  new URLSearchParams(window.location.search).get("preview") ===
                    "1";
                router.push(
                  `/announcer/morning-news${preview ? "?preview=1" : ""}`,
                );
              })
            }
          >
            <NavigationIcon />
          </button>
          <h1 className="text-[17px] leading-6 font-bold">연습하기</h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-[#edf2ff] px-[11px] py-[5px] text-xs leading-4 font-bold text-[#2447aa]">
              아나운서 따라 읽기
            </span>
            <span className="text-[13px] leading-[18px] text-[#8b95a1]">
              {recording
                ? "이어서 읽어주세요"
                : recorded
                  ? "3문장 녹음 완료"
                  : "3문장 ㅣ 약 45초"}
            </span>
          </div>
          {recorded && recorder.blob && recorder.previewUrl && (
            <>
              <AnnouncerRecordingReview
                blob={recorder.blob}
                url={recorder.previewUrl}
                durationMs={recorder.durationMs}
              />
              <h2 className="mt-5 text-[15px] leading-[22px] font-bold">
                읽은 문장
              </h2>
            </>
          )}
          <div className="mt-3.5 flex flex-col gap-4 rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
            {SCRIPT.map((sentence, index) => (
              <p
                key={sentence}
                className={`text-[16px] leading-6 font-medium transition-colors duration-300 ${recording && index > 0 ? "text-[#8b95a1]" : "text-[#191f28]"}`}
              >
                {sentence}
              </p>
            ))}
          </div>
        </div>

        {recorded ? (
          <footer className="shrink-0 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-9">
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => guard.request("retry", recorder.reset)}
                className="h-14 flex-1 touch-manipulation rounded-full border border-[#e5e8eb] bg-white text-base font-bold transition-transform active:scale-[0.98]"
              >
                {practiceCopy.retry}
              </button>
              <button
                type="button"
                onClick={() => setShowResult(true)}
                className="h-14 flex-1 touch-manipulation rounded-full bg-[#2f6bff] text-base font-bold text-white transition-transform active:scale-[0.98]"
              >
                {practiceCopy.analyze}
              </button>
            </div>
          </footer>
        ) : (
          <footer className="shrink-0 px-5 pb-7 text-center">
            {recording && (
              <div className="mb-4">
                <div
                  className="mb-5 flex h-16 items-center justify-center gap-1"
                  aria-hidden="true"
                >
                  <PracticeWave active />
                </div>
                <p className="flex items-center justify-center gap-2 text-base font-bold tabular-nums">
                  <span className="size-2 rounded-full bg-[#d91b34]" />
                  {time}
                </p>
              </div>
            )}
            {recorder.error && (
              <p role="alert" className="mb-4 text-sm text-[#d91b34]">
                {recorder.error}
              </p>
            )}
            <button
              type="button"
              disabled={requesting}
              aria-label={
                recording
                  ? practiceCopy.stop
                  : recorded
                    ? "다시 녹음"
                    : practiceCopy.start
              }
              onClick={() => {
                if (recording) recorder.stop();
                else void recorder.start();
              }}
              className="mx-auto flex size-[76px] touch-manipulation items-center justify-center rounded-full bg-[#2f6bff] text-white transition-transform duration-200 active:scale-95 disabled:opacity-60 motion-reduce:transition-none"
            >
              {recording ? (
                <Square
                  size={24}
                  fill="currentColor"
                  strokeWidth={0}
                  className="rounded-md"
                />
              ) : (
                <Mic size={28} strokeWidth={2} />
              )}
            </button>
            <p className="mt-4 text-[13px] leading-[18px] font-medium text-[#4e5968]">
              {recording
                ? practiceCopy.recording
                : requesting
                  ? "마이크 권한을 확인하고 있어요"
                  : recorded
                    ? "다시 녹음하려면 버튼을 눌러주세요"
                    : practiceCopy.ready}
            </p>
          </footer>
        )}
      </section>
    </IPhoneFrame>
  );
}
