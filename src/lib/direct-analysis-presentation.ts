import type { AnalysisResult } from "@/lib/api";
import { canonicalCriterionPoints } from "@/lib/canonical-score";
import type { DirectResult } from "@/lib/direct-analysis";

/** Adapt transport data to the existing report; never infer sentence grades. */
export function directAnalysisPresentation(
  result: DirectResult,
): AnalysisResult {
  const feedback = result.coaching.feedback?.trim();
  const itemFeedback = result.coaching.items
    .map(({ expression }) =>
      [
        expression.explanation,
        expression.action,
        expression.practice,
        expression.selfCheck,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
  return {
    id: result.sourceIdentity.executionId,
    status: result.failure ? "FAILED" : "COMPLETED",
    outcome: null,
    transcript: null,
    sttConfidence: null,
    overallScore: result.score.overallScore,
    pronunciationScore: null,
    intonationScore: null,
    speedWpm: null,
    speedStatus: null,
    stressScore: null,
    pauseScore: null,
    strengths: [],
    weaknesses: [],
    summaryFeedback:
      feedback ||
      itemFeedback ||
      (result.failure
        ? "분석 근거를 확정하지 못했습니다. 다시 녹음해 주세요."
        : result.decision.status !== "ACCEPT"
          ? "이번 입력은 평가를 완료하지 못했습니다. 녹음과 문장을 확인해 주세요."
          : "제공된 AI 총평이 없습니다."),
    pronunciationEvidence: null,
    visualSupplement: null,
    analyzedAt: null,
    scoreHierarchy:
      result.score.validity === "RUBRIC_COMPUTED"
        ? {
            rubricRevision: result.score.rubricRevision,
            leafCount: 0,
            groups: canonicalCriterionPoints(result.score).map((row) => ({
              id: row.criterionId,
              label: row.label,
              description: "이번 녹음에서 제공된 항목별 발음 점수입니다.",
              maxScore: row.maxPoints,
              score: row.points,
              items: [],
            })),
          }
        : null,
  };
}
