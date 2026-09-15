"use client";

import { useState } from "react";
import Image from "next/image";
import { RecordingPlayback } from "@/components/recording-playback";
import { ReferencePlayer } from "@/components/reference-player";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  AnalysisResult,
  AnalysisSegment,
  PracticeContent,
} from "@/lib/api";

const card =
  "space-y-3 rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]";
function Tip({
  children,
  heading = false,
}: {
  children: React.ReactNode;
  heading?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-[#edf2ff] px-3.5 py-3">
      <Image
        src="/figma/auth/result-ai.svg"
        alt=""
        width={16}
        height={16}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        {heading && (
          <h3 className="mb-1 text-sm leading-5 font-bold text-[#2c4a9a]">
            AI 피드백
          </h3>
        )}
        <p
          className={
            heading
              ? "text-xs leading-4 text-[#6b85c7]"
              : "text-[13px] leading-[18px] font-medium text-[#2c4a9a]"
          }
        >
          {children}
        </p>
      </div>
    </div>
  );
}

// Preserve the existing local-only sample analysis and its detail interactions.
export function MyScriptResult({
  analysis,
  content,
  source,
  durationSeconds,
  segments,
  regenerating,
  onRegenerate,
  onRetry,
  onFinish,
}: {
  analysis: AnalysisResult;
  content: PracticeContent;
  source?: string;
  durationSeconds: number;
  segments: AnalysisSegment[];
  regenerating: boolean;
  onRegenerate: () => void;
  onRetry: () => void;
  onFinish: () => void;
}) {
  const [tab, setTab] = useState<"pronunciation" | "prosody">("pronunciation");
  const [selected, setSelected] = useState<AnalysisSegment | null>(null);
  const [selectedSyllable, setSelectedSyllable] = useState(0);
  const points = segments.filter(
    (segment) => segment.resultStatus !== "NORMAL",
  );
  const speed = ["TOO_SLOW", "SLOW"].includes(analysis.speedStatus)
    ? "느림"
    : ["TOO_FAST", "FAST"].includes(analysis.speedStatus)
      ? "빠름"
      : "보통";
  const speedIndex = speed === "느림" ? 0 : speed === "빠름" ? 2 : 1;
  return (
    <div className="script-result flex min-h-[calc(100dvh-92px)] flex-col">
      <div className="space-y-4 px-5 pt-2 pb-6">
        <section
          className="space-y-4 rounded-[18px] px-5 pt-[22px] pb-[18px] text-white shadow-[0_8px_20px_-4px_rgba(41,92,229,0.28)]"
          style={{
            backgroundImage:
              "linear-gradient(143deg,#2a63f6 17.5%,#5e8cff 82.5%)",
          }}
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] leading-[18px] font-medium text-white/72">
                발음 정확도
              </p>
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] leading-[14px] font-bold">
                {analysis.pronunciationScore >= 80 ? "좋음" : "연습 필요"}
              </span>
            </div>
            <p className="mt-1">
              <b className="text-[40px] leading-[52px] tracking-[-1.128px]">
                {Math.round(analysis.pronunciationScore)}
              </b>
              <span className="text-lg font-medium text-white/72">점</span>
            </p>
          </div>
          <p className="text-sm leading-5 font-medium text-white/90">
            {analysis.summaryFeedback}
          </p>
          <div className="result-audio">
            <RecordingPlayback
              source={source}
              durationSeconds={durationSeconds}
              title="내 녹음"
            />
          </div>
        </section>
        <section
          aria-label="분석 요약 · 예시"
          className="grid grid-cols-3 divide-x divide-[#e5e8eb] rounded-2xl bg-white px-2 py-4 text-center shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
        >
          {[
            [String(Math.round(analysis.overallScore)), "점", "종합 점수"],
            [speed, "", "말하기 속도"],
            [String(Math.round(analysis.intonationScore)), "점", "억양"],
          ].map(([value, unit, label]) => (
            <div key={label}>
              <p className="text-lg leading-[26px] font-bold">
                {value}
                <span className="text-xs font-medium text-[#8b95a1]">
                  {unit}
                </span>
              </p>
              <p className="mt-[5px] text-[11px] leading-[14px] text-[#8b95a1]">
                {label}
              </p>
            </div>
          ))}
        </section>
        <div
          role="tablist"
          aria-label="분석 항목"
          className="flex border-b border-[#e5e8eb]"
        >
          {(
            [
              ["pronunciation", "발음"],
              ["prosody", "속도와 억양"],
            ] as const
          ).map(([id, label], index) => (
            <button
              key={id}
              id={`script-${id}-tab`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`script-${id}-panel`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "pronunciation"
                    : event.key === "End"
                      ? "prosody"
                      : index === 0
                        ? "prosody"
                        : "pronunciation";
                setTab(next);
                document.getElementById(`script-${next}-tab`)?.focus();
              }}
              className={`flex-1 border-b-2 px-0.5 pt-2.5 pb-3 text-base leading-5 tracking-[0.232px] ${tab === id ? "border-[#191f28] font-bold" : "border-transparent font-medium text-[#8b95a1]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`script-${tab}-panel`}
          aria-labelledby={`script-${tab}-tab`}
          className="space-y-3.5"
        >
          {tab === "pronunciation" ? (
            <>
              <div className="flex justify-between text-[15px] leading-[22px] font-bold">
                <h2>발음 연습 포인트</h2>
                <span>{points.length}개</span>
              </div>
              <div className="divide-y divide-[#e5e8eb] rounded-2xl bg-white px-4 py-1 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
                {points.map((word, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => {
                      setSelected(word);
                      setSelectedSyllable(0);
                    }}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span className="flex min-h-10 w-[90px] shrink-0 items-center justify-center rounded-[10px] bg-[#f2f4f6] px-2 py-1 text-sm font-bold [overflow-wrap:anywhere]">
                      {word.targetUnit || word.expectedText}
                    </span>
                    <span className="min-w-0 flex-1 space-y-[3px] text-xs leading-4 text-[#8b95a1]">
                      <span className="block">{word.feedback}</span>
                      <span className="block">{word.sequenceNo}번 구간</span>
                    </span>
                    <Image
                      src="/figma/auth/result-chevron.svg"
                      alt="상세 보기"
                      width={18}
                      height={18}
                    />
                  </button>
                ))}
              </div>
              <Tip heading>
                {analysis.weaknesses.join(" ") || analysis.summaryFeedback}
              </Tip>
            </>
          ) : (
            <>
              <section className={card}>
                <div className="flex justify-between">
                  <h2 className="text-[15px] leading-[22px] font-bold">
                    말하기 속도
                  </h2>
                  <p className="text-xs text-[#8b95a1]">
                    분당{" "}
                    <b className="text-[15px] text-[#191f28]">
                      {Math.round(analysis.speedWpm)}
                    </b>
                    단어
                  </p>
                </div>
                <div className="flex h-2.5 gap-[3px]">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className={`flex-1 rounded-full ${index === speedIndex ? "bg-[#2f6bff]" : "bg-[#e5e8eb]"}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[11px] text-[#8b95a1]">
                  <span>느림</span>
                  <span>보통</span>
                  <span>빠름</span>
                </div>
                <Tip>{analysis.summaryFeedback}</Tip>
              </section>
              <section className={card}>
                <div className="flex justify-between">
                  <h2 className="text-[15px] leading-[22px] font-bold">
                    억양 변화
                  </h2>
                  <span className="text-xs text-[#8b95a1]">
                    {Math.round(analysis.intonationScore)}점
                  </span>
                </div>
                <div className="rounded-xl bg-[#f2f4f6] p-4 text-sm text-[#8b95a1]">
                  억양 곡선 데이터가 제공되지 않았습니다.
                </div>
                <Tip>
                  {analysis.strengths.join(" ") || analysis.summaryFeedback}
                </Tip>
                <p className="text-xs text-[#8b95a1]">
                  강세 {Math.round(analysis.stressScore)}점
                </p>
              </section>
              <section className={card}>
                <div className="flex justify-between">
                  <h2 className="text-[15px] leading-[22px] font-bold">
                    문장 사이 쉼
                  </h2>
                  <span className="text-[13px] text-[#8b95a1]">
                    {Math.round(analysis.pauseScore)}점
                  </span>
                </div>
                <p className="text-xs text-[#8b95a1]">
                  문장별 쉼 시간 데이터가 제공되지 않았습니다.
                </p>
                <Tip>
                  {analysis.weaknesses.join(" ") || analysis.summaryFeedback}
                </Tip>
              </section>
            </>
          )}
          <details className={card}>
            <summary className="cursor-pointer text-sm font-semibold">
              AI 코칭
            </summary>
            <div className="mt-3 space-y-3 text-sm">
              {analysis.strengths.map((item) => (
                <p key={item}>{item}</p>
              ))}
              {analysis.weaknesses.map((item) => (
                <p key={item}>{item}</p>
              ))}
              <p>{analysis.summaryFeedback}</p>
              <button
                type="button"
                disabled={regenerating}
                onClick={onRegenerate}
                className="text-primary"
              >
                {regenerating ? "코칭 생성 중…" : "AI 코칭 다시 생성"}
              </button>
            </div>
          </details>
          <p className="text-[11px] text-[#8b95a1]">
            내 문장 체험의 분석 결과는 예시입니다. 녹음은 이 기기에서만
            재생됩니다.
          </p>
        </div>
      </div>
      <div className="sticky bottom-0 mt-auto flex gap-2.5 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-[calc(12px+max(24px,env(safe-area-inset-bottom)))]">
        <button
          type="button"
          onClick={onRetry}
          className="h-14 flex-1 rounded-full border border-[#e5e8eb] text-base font-bold"
        >
          다시 읽기
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="h-14 flex-1 rounded-full bg-[#2f6bff] text-base font-bold text-white"
        >
          연습 마치기
        </button>
      </div>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="learning-shell !top-0 !h-dvh !max-h-dvh !w-full !max-w-[402px] !translate-y-0 overflow-y-auto !rounded-none border-0 !p-5 !pt-12">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">
                  {selected.sequenceNo}번 구간
                </DialogTitle>
                <DialogDescription className="text-center text-muted-foreground">
                  발음을 확인하고 다시 연습해 보세요
                </DialogDescription>
              </DialogHeader>
              <section className="design-card">
                <div className="mb-5 flex justify-between text-xs text-muted-foreground">
                  <span>음절을 눌러 확인해 보세요</span>
                  <b className="text-primary">
                    {Math.round(selected.pronunciationScore)}점
                  </b>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selected.expectedText).map((char, index) => (
                    <button
                      type="button"
                      aria-pressed={selectedSyllable === index}
                      onClick={() => setSelectedSyllable(index)}
                      key={index}
                      className={`rounded-lg px-2 py-2 text-lg ${selectedSyllable === index ? "ring-2 ring-primary" : ""} ${selected.resultStatus === "NORMAL" ? "bg-[#f2f4f6]" : "bg-[#ffebe5] text-[#ef7157]"}`}
                    >
                      {char}
                    </button>
                  ))}
                </div>
                <p className="mt-5 text-xs text-muted-foreground">
                  ● 정확　<span className="text-[#ef7157]">● 개선 필요</span>
                </p>
              </section>
              {source && (
                <ReferencePlayer source={source} title="내 발음 다시 듣기" />
              )}
              <section className="design-card">
                <h2 className="text-2xl font-bold">{selected.expectedText}</h2>
                <p className="mt-4 text-xs text-muted-foreground">
                  이렇게 들렸어요
                </p>
                <p className="mt-1 text-lg font-bold text-[#ef7157]">
                  {selected.recognizedText || "누락"}
                </p>
                <h3 className="mt-5 text-sm font-bold">무엇이 문제였나요</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selected.feedback || "인식한 발음과 원문을 비교해 보세요."}
                </p>
                <h3 className="mt-5 text-sm font-bold">이렇게 해보세요</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  예시를 듣고 어려운 소리를 천천히 나누어 읽어 보세요.
                </p>
                {content.referenceAudioAvailable && (
                  <div className="mt-4">
                    <ReferencePlayer contentId={content.id} title="기준 발음" />
                  </div>
                )}
              </section>
              <button
                className="design-action"
                onClick={() => setSelected(null)}
              >
                확인
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
