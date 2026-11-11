"use client";

import { AnalysisView } from "@/components/analysis-view";
import type { AnalysisResult, AnalysisSegment } from "@/lib/api";
import type { PublicScoreDetails } from "@/lib/score-details";

/*
 * Dev-only: the result after "녹음을 확인해 주세요" → 분석 요청 for a
 * five-sentence news read in one take. Sample data only; the screen itself is
 * the production AnalysisView.
 */

const SENTENCES = [
  "정책 변화가 지역 산업과 생활 방식에 미치는 영향을 분석했습니다.",
  "자료를 비교한 결과 예상보다 큰 차이가 나타났지만 해결책을 찾았습니다.",
  "새로운 기준을 적용해 전체 결과를 다시 검토했습니다.",
  "청중이 이해할 수 있도록 핵심 내용을 단계별로 설명하겠습니다.",
  "지금까지 확인한 내용을 바탕으로 다음 실행 계획을 정리하겠습니다.",
];

const SEGMENTS: AnalysisSegment[] = [
  ["NORMAL", 86.4, null, null],
  [
    "NEEDS_IMPROVEMENT",
    58.2,
    "결과",
    "받침 ㄹ이 약하게 들렸어요. 혀끝을 윗잇몸에 붙였다 떼며 읽어 보세요.",
  ],
  ["NORMAL", 81.7, null, null],
  [
    "CAUTION",
    69.5,
    "단계별로",
    "'단계별로'를 한 덩어리로 이어 읽으면 더 자연스러워요.",
  ],
  ["NORMAL", 84.0, null, null],
].map(([status, score, target, feedback], index) => ({
  id: index + 1,
  sequenceNo: index + 1,
  expectedText: SENTENCES[index],
  recognizedText: SENTENCES[index],
  startMs: index * 5000,
  endMs: index * 5000 + 4600,
  matchType: "MATCH",
  resultStatus: status as AnalysisSegment["resultStatus"],
  targetUnit: target as string | null,
  errorType: target ? "PRONUNCIATION" : null,
  pronunciationScore: score as number,
  intonationScore: null,
  feedback: feedback as string | null,
}));

const DETAILS: PublicScoreDetails = {
  schemaVersion: "voice-coaching.score-details.v1",
  validationStatus: "EXPERT_REVIEW_PENDING",
  aggregationMode: "AUDIO_ONLY",
  audioScore: 76.3,
  visualScore: null,
  audioWeight: 100,
  visualWeight: 0,
  criteria: (
    [
      ["pronunciation_accuracy", "발음 정확성", 40, 82.1],
      ["speaking_rate", "발음 속도", 10, 74.0],
      ["articulation_rate", "조음 속도", 10, 71.2],
      ["pauses", "쉼", 10, 78.5],
      ["pitch", "억양·음높이", 15, 66.4],
      ["intensity", "음량·강도", 15, 72.9],
    ] as const
  ).map(([criterionId, label, weight, score]) => ({
    criterionId,
    label,
    weight,
    reasonCode: "OK",
    status: "SCORED" as const,
    score,
  })),
};

const ANALYSIS: AnalysisResult = {
  id: 1,
  status: "COMPLETED",
  outcome: "COACHING_READY",
  transcript: SENTENCES.join(" "),
  sttConfidence: 0.93,
  overallScore: 76.3,
  pronunciationScore: 76.3,
  intonationScore: null,
  speedWpm: null,
  speedStatus: null,
  stressScore: null,
  pauseScore: null,
  strengths: [],
  weaknesses: [],
  summaryFeedback:
    "전체적으로 또박또박 잘 읽었어요. 2번째 문장의 받침과 4번째 문장의 이어 읽기를 조금만 다듬으면 더 자연스러워요.",
  pronunciationEvidence: null,
  visualSupplement: null,
  analyzedAt: new Date().toISOString(),
  scoreDetails: DETAILS,
};

export function NewsResultPreview() {
  return (
    <main className="mx-auto min-h-dvh max-w-[402px] bg-[#f2f4f6]">
      <header className="flex h-12 items-center justify-center text-[17px] font-bold">
        분석 결과
      </header>
      <div className="report-reveal">
        <AnalysisView
          analysis={ANALYSIS}
          segments={SEGMENTS}
          content={{
            id: "preview-news",
            contentType: "NEWS",
            title: "경제 뉴스 연습 4 - 농산물 직거래",
            scriptText: SENTENCES.join(" "),
            referenceAudioAvailable: false,
          }}
          recordingId={1}
          previousScore={{ score: 71.8, scope: "content" }}
        />
      </div>
    </main>
  );
}
