"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { AnalysisView } from "@/components/analysis-view";
import {
  SentenceResultPending,
  SentenceResultTabs,
} from "@/components/sentence-result-tabs";
import type { AnalysisResult } from "@/lib/api";
import type { PublicScoreDetails } from "@/lib/score-details";

/*
 * Dev-only mirror of the multi-sentence result screen in
 * sentence-practice-sequence.tsx, filled with sample data (the 4th sentence is
 * still "analysing") so it can be inspected without recording.
 */

export const SENTENCES = [
  "예비 창업자를 위한 맞춤형 상담 창구가 마련됐습니다.",
  "전문가들은 사업 계획과 자금 운용에 관한 단계별 조언을 제공합니다.",
  "상담은 온라인과 오프라인 모두에서 신청할 수 있습니다.",
  "자세한 내용은 지역 창업지원센터 누리집에서 확인할 수 있습니다.",
];

function details(scores: number[], audioScore: number): PublicScoreDetails {
  const meta = [
    ["pronunciation_accuracy", "발음 정확성", 40],
    ["speaking_rate", "발음 속도", 10],
    ["articulation_rate", "조음 속도", 10],
    ["pauses", "쉼", 10],
    ["pitch", "억양·음높이", 15],
    ["intensity", "음량·강도", 15],
  ] as const;
  return {
    schemaVersion: "voice-coaching.score-details.v1",
    validationStatus: "EXPERT_REVIEW_PENDING",
    aggregationMode: "AUDIO_ONLY",
    audioScore,
    visualScore: null,
    audioWeight: 100,
    visualWeight: 0,
    criteria: meta.map(([criterionId, label, weight], index) => ({
      criterionId,
      label,
      weight,
      reasonCode: "OK",
      status: "SCORED" as const,
      score: scores[index],
    })),
  };
}

export function result(
  id: number,
  overallScore: number,
  summaryFeedback: string,
  scores: number[],
): AnalysisResult {
  return {
    id,
    status: "COMPLETED",
    outcome: "COACHING_READY",
    transcript: SENTENCES[id - 1],
    sttConfidence: 0.92,
    overallScore,
    pronunciationScore: overallScore,
    intonationScore: null,
    speedWpm: null,
    speedStatus: null,
    stressScore: null,
    pauseScore: null,
    strengths: [],
    weaknesses: [],
    summaryFeedback,
    pronunciationEvidence: null,
    visualSupplement: null,
    analyzedAt: new Date().toISOString(),
    scoreDetails: details(scores, overallScore),
  };
}

export const RESULTS = [
  result(
    1,
    72.4,
    "또박또박 잘 읽었어요. '맞춤형'의 받침 소리를 조금 더 분명하게 내면 좋아요.",
    [84.2, 61.5, 66.0, 74.8, 58.3, 69.1],
  ),
  result(
    2,
    67.5,
    "문장 흐름이 자연스러워요. 문장 끝으로 갈수록 목소리가 작아지니 끝까지 힘을 유지해 보세요.",
    [87.5, 48.8, 54.1, 71.3, 56.6, 43.7],
  ),
  result(
    3,
    81.2,
    "속도와 쉼이 안정적이에요. '온라인과'를 한 덩어리로 이어 읽으면 더 자연스러워요.",
    [90.1, 78.4, 80.2, 85.0, 72.5, 76.9],
  ),
];

// Sample comparisons: up vs. this content, down vs. recent practice, none.
const PREVIOUS = [
  { score: 68.2, scope: "content" as const },
  { score: 70.1, scope: "recent" as const },
  null,
];

export function SentenceResultsPreview() {
  const [active, setActive] = useState(0);
  return (
    <main className="mx-auto min-h-dvh max-w-[402px] bg-[#f2f4f6] pb-5">
      <SentenceResultTabs
        active={active}
        onSelect={setActive}
        tabs={SENTENCES.map((text, index) => ({
          key: text,
          text,
          state: RESULTS[index] ? "ready" : "pending",
          score: RESULTS[index]?.overallScore,
          details: RESULTS[index]?.scoreDetails,
        }))}
        renderPanel={(shown) => (
          <>
            {RESULTS[shown] ? (
              <>
                <AnalysisView
                  key={shown}
                  analysis={RESULTS[shown]}
                  segments={[]}
                  content={{
                    id: `preview-${shown}`,
                    contentType: "NEWS",
                    title: "미리보기",
                    scriptText: SENTENCES[shown],
                    referenceAudioAvailable: false,
                  }}
                  recordingId={shown + 1}
                  reportParameter={`sentenceReport${shown}`}
                  courseMode={false}
                  previousScore={PREVIOUS[shown]}
                />
                {/* Same button as the live screen; visual only here. */}
                <div className="px-5 pt-1 pb-2">
                  <button
                    type="button"
                    className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-white text-[15px] font-bold text-[#4e5968] shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
                  >
                    <RotateCcw
                      size={17}
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                    이 문장 다시 녹음
                  </button>
                </div>
              </>
            ) : (
              <SentenceResultPending />
            )}
          </>
        )}
      />
      <div className="space-y-4 px-5 pt-2">
        <button className="design-action">완료하기</button>
        <button className="min-h-11 w-full text-sm text-muted-foreground">
          학습 기록에서 확인
        </button>
      </div>
    </main>
  );
}
