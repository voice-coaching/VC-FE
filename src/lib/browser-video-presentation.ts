import type { AnalysisResult } from "./api";
import type { BrowserVideoResult } from "./api/browser-video";

/** AI's public result is its own view model; no synthetic Backend analysis/recording IDs or regrading. */
export function browserVideoPresentation(
  result: BrowserVideoResult,
): AnalysisResult {
  const failed = result.status === "FAILED" || result.failure !== null;
  const feedback = result.coaching.feedback;
  return {
    id: result.jobId,
    status: failed ? "FAILED" : "COMPLETED",
    outcome: null,
    transcript: null,
    sttConfidence: null,
    overallScore: failed ? null : result.score.overallScore,
    pronunciationScore: null,
    intonationScore: null,
    speedWpm: null,
    speedStatus: null,
    stressScore: null,
    pauseScore: null,
    strengths: [],
    weaknesses: [],
    summaryFeedback: feedback.trim()
      ? feedback
      : failed
        ? "영상 분석 결과를 확정하지 못했어요. 시스템 실패를 발음 문제로 해석하지 마세요."
        : "제공된 AI 총평이 없습니다.",
    pronunciationEvidence: null,
    visualSupplement: null,
    analyzedAt: null,
  };
}
