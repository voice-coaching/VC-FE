"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ReferencePlayer } from "@/components/reference-player";
import type {
  AnalysisResult,
  AnalysisSegment,
  PracticeContent,
} from "@/lib/api";

export function AnalysisView({
  analysis,
  segments,
  content,
  recordingUrl,
  courseMode = false,
}: {
  analysis: AnalysisResult;
  segments: AnalysisSegment[];
  content: PracticeContent;
  recordingUrl?: string;
  courseMode?: boolean;
}) {
  const sentenceTabs =
    content.contentType === "NEWS" || content.contentType === "ANNOUNCER";
  const [tab, setTab] = useState(sentenceTabs ? "sentences" : "pronunciation");
  const [selectedSyllable, setSelectedSyllable] = useState(0);
  const [selected, setSelected] = useState<AnalysisSegment | null>(null);
  const problems = segments.filter(
    (segment) => segment.resultStatus !== "NORMAL",
  );
  const speed = ["TOO_SLOW", "SLOW"].includes(analysis.speedStatus)
    ? "느림"
    : ["TOO_FAST", "FAST"].includes(analysis.speedStatus)
      ? "빠름"
      : "보통";
  return (
    <>
      <section className="rounded-[20px] bg-gradient-to-br from-[#285df5] to-[#5c86ff] p-5 text-white shadow-[0_8px_16px_#3468ff20]">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/80">
            {courseMode && content.learningFocus === "INTONATION"
              ? "억양 정확도"
              : "발음 정확도"}
          </p>
          <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold">
            {analysis.pronunciationScore >= 80
              ? "좋음"
              : analysis.pronunciationScore >= 60
                ? "보통"
                : "연습 필요"}
          </span>
        </div>
        <p className="mt-2 text-[42px] leading-tight font-bold">
          {Math.round(
            courseMode && content.learningFocus === "INTONATION"
              ? analysis.intonationScore
              : analysis.pronunciationScore,
          )}
          <span className="text-sm font-normal">점</span>
        </p>
        <p className="mt-3 text-sm leading-6">{analysis.summaryFeedback}</p>
        {recordingUrl && (
          <div className="mt-4">
            <ReferencePlayer
              source={recordingUrl}
              title="내 발음 다시 듣기"
              compact
            />
          </div>
        )}
      </section>
      {courseMode ? (
        <>
          <section className="design-card">
            <h2 className="mb-4 text-sm font-bold">
              {content.learningFocus === "INTONATION"
                ? "문장 끝 억양 확인"
                : "발음 소리 확인"}
            </h2>
            {content.learningFocus === "INTONATION" && (
              <>
                <svg
                  viewBox="0 0 320 100"
                  role="img"
                  aria-label="문장 끝 억양 비교 예시"
                  className="mb-3 w-full"
                >
                  <path
                    d="M10 36 Q90 15 150 34 T240 38 L305 80"
                    fill="none"
                    stroke="#9eb7ff"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <path
                    d="M10 40 Q90 20 150 38 T240 45 L305 72"
                    fill="none"
                    stroke="#3468ff"
                    strokeWidth="3"
                  />
                </svg>
                <p className="mb-4 text-xs text-muted-foreground">
                  내 억양 · 기준 억양 비교 예시
                </p>
              </>
            )}
            {analysis.strengths.map((item) => (
              <p key={item} className="mb-2 text-sm leading-6">
                {item}
              </p>
            ))}
            <p className="text-sm leading-6 text-muted-foreground">
              {analysis.summaryFeedback}
            </p>
          </section>
          <section className="design-card">
            <h2 className="mb-3 text-sm font-bold">다음에도 이렇게 해보세요</h2>
            {analysis.weaknesses.length ? (
              analysis.weaknesses.map((item) => (
                <p
                  key={item}
                  className="text-sm leading-6 text-muted-foreground"
                >
                  {item}
                </p>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                지금처럼 문장 끝까지 또렷하게 읽어 주세요.
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="design-card grid grid-cols-3 divide-x divide-border !px-2 text-center">
            <div>
              <b className="text-lg">
                {Math.round(analysis.overallScore)}
                <small className="text-xs">점</small>
              </b>
              <p className="mt-1 text-[10px] text-muted-foreground">
                종합 점수
              </p>
            </div>
            <div>
              <b className="text-lg">{speed}</b>
              <p className="mt-1 text-[10px] text-muted-foreground">
                말하기 속도
              </p>
            </div>
            <div>
              <b className="text-lg">
                {Math.round(analysis.intonationScore)}
                <small className="text-xs">점</small>
              </b>
              <p className="mt-1 text-[10px] text-muted-foreground">억양</p>
            </div>
          </section>
          <div
            className="design-tabs"
            style={{
              gridTemplateColumns: `repeat(${sentenceTabs ? 3 : 2}, minmax(0,1fr))`,
            }}
            role="tablist"
            aria-label="분석 항목"
          >
            {sentenceTabs && (
              <button
                type="button"
                role="tab"
                id="sentences-tab"
                aria-controls="analysis-panel"
                aria-selected={tab === "sentences"}
                onClick={() => setTab("sentences")}
              >
                문장별
              </button>
            )}
            <button
              type="button"
              role="tab"
              id="pronunciation-tab"
              aria-controls="analysis-panel"
              aria-selected={tab === "pronunciation"}
              onClick={() => setTab("pronunciation")}
            >
              {sentenceTabs ? "발음 상세" : "발음"}
            </button>
            <button
              type="button"
              role="tab"
              id="prosody-tab"
              aria-controls="analysis-panel"
              aria-selected={tab === "prosody"}
              onClick={() => setTab("prosody")}
            >
              속도와 억양
            </button>
          </div>
          <div
            id="analysis-panel"
            role="tabpanel"
            aria-labelledby={`${tab}-tab`}
            className="space-y-5"
          >
            {tab === "sentences" ? (
              <div className="space-y-3">
                {segments.length ? (
                  segments.map((segment) => (
                    <button
                      key={String(segment.id)}
                      type="button"
                      onClick={() => {
                        setSelected(segment);
                        setSelectedSyllable(0);
                      }}
                      className="design-card flex w-full items-center gap-3 !p-4 text-left"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold leading-6">
                          {segment.expectedText}
                        </p>
                        {segment.resultStatus !== "NORMAL" && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            이렇게 들렸어요{" "}
                            <span className="ml-1 text-[#ff684c]">
                              {segment.recognizedText || "누락"}
                            </span>
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 text-xs ${segment.resultStatus === "NORMAL" ? "text-muted-foreground" : "text-[#ff684c]"}`}
                      >
                        {Math.round(segment.pronunciationScore)}점
                      </span>
                      <ChevronRight className="size-4 shrink-0" />
                    </button>
                  ))
                ) : (
                  <section className="design-card text-sm leading-6">
                    {analysis.transcript}
                  </section>
                )}
              </div>
            ) : tab === "pronunciation" ? (
              <>
                <section className="design-card">
                  <div className="mb-4 flex justify-between text-xs text-muted-foreground">
                    <span>구간을 눌러 확인해 보세요</span>
                    <span>{segments.length}구간</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {segments.map((segment) => (
                      <button
                        type="button"
                        key={String(segment.id)}
                        onClick={() => {
                          setSelected(segment);
                          setSelectedSyllable(0);
                        }}
                        className={`min-h-10 min-w-9 rounded-lg px-2 py-2 text-base font-medium ${segment.resultStatus === "NORMAL" ? "bg-muted" : "bg-rose-50 text-rose-500"}`}
                      >
                        {segment.expectedText}
                      </button>
                    ))}
                    {segments.length === 0 && (
                      <p className="text-sm leading-6">{analysis.transcript}</p>
                    )}
                  </div>
                  <p className="mt-5 text-[10px] text-muted-foreground">
                    ● 정확　<span className="text-rose-400">● 개선 필요</span>
                  </p>
                </section>
                <section>
                  <div className="mb-3 flex justify-between">
                    <h2 className="text-sm font-bold">개선이 필요한 구간</h2>
                    <span className="text-xs text-muted-foreground">
                      {problems.length}개
                    </span>
                  </div>
                  <div className="design-card divide-y divide-border !py-0">
                    {problems.map((segment) => (
                      <button
                        type="button"
                        key={String(segment.id)}
                        onClick={() => {
                          setSelected(segment);
                          setSelectedSyllable(0);
                        }}
                        className="flex w-full items-center gap-3 py-4 text-left"
                      >
                        <span className="rounded-lg bg-muted px-3 py-2 font-bold">
                          {segment.expectedText}
                        </span>
                        <span className="flex-1 text-xs">
                          <span className="text-muted-foreground">
                            이렇게 들렸어요{" "}
                          </span>
                          <span className="text-rose-500">
                            {segment.recognizedText || "누락"}
                          </span>
                          <span className="mt-1 block leading-5 text-muted-foreground">
                            {segment.feedback}
                          </span>
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    ))}
                    {problems.length === 0 && (
                      <p className="py-5 text-sm text-muted-foreground">
                        개선이 필요한 구간이 없습니다.
                      </p>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="design-card">
                  <div className="flex justify-between text-sm">
                    <h2 className="font-bold">말하기 속도</h2>
                    <span className="text-muted-foreground">
                      분당{" "}
                      <b className="text-foreground">
                        {Math.round(analysis.speedWpm)}
                      </b>
                      단어
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-1">
                    {["느림", "보통", "빠름"].map((label) => (
                      <div key={label}>
                        <div
                          className={`h-2 rounded-full ${speed === label ? "bg-primary" : "bg-muted"}`}
                        />
                        <p
                          className={`mt-2 text-center text-[10px] ${speed === label ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {label === "보통" ? "적정" : label}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="design-card">
                  <h2 className="mb-5 text-sm font-bold">억양 변화</h2>
                  <figure className="mb-5">
                    <svg
                      viewBox="0 0 320 100"
                      role="img"
                      aria-label="내 억양과 기준 억양 비교 예시"
                      className="w-full rounded-xl bg-muted p-2"
                    >
                      <path
                        d="M5 63C35 8 48 14 77 47S122 35 148 34S189 77 221 61S262 23 285 43S305 52 315 62"
                        fill="none"
                        stroke="#b7c2d9"
                        strokeWidth="2"
                        strokeDasharray="5 5"
                      />
                      <path
                        d="M5 69C33 24 47 21 77 54S126 27 151 40S193 85 220 68S264 23 285 48S306 56 315 68"
                        fill="none"
                        stroke="#3468ff"
                        strokeWidth="2"
                      />
                    </svg>
                    <figcaption className="mt-2 text-[10px] text-muted-foreground">
                      <span className="text-primary">━ 내 억양</span>　┄ 기준
                      억양　· 비교 예시
                    </figcaption>
                  </figure>
                  <div className="space-y-4">
                    {[
                      { label: "억양", score: analysis.intonationScore },
                      { label: "강세", score: analysis.stressScore },
                      { label: "쉼", score: analysis.pauseScore },
                    ].map(({ label, score }) => (
                      <div key={label}>
                        <div className="mb-2 flex justify-between text-xs">
                          <span>{label}</span>
                          <span className="text-primary">
                            {Math.round(score)}점
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.min(100, Math.max(0, score))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-xs leading-5 text-muted-foreground">
                    {analysis.summaryFeedback}
                  </p>
                </section>
              </>
            )}
          </div>
        </>
      )}
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
              {recordingUrl && (
                <ReferencePlayer
                  source={recordingUrl}
                  title="내 발음 다시 듣기"
                />
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
    </>
  );
}
