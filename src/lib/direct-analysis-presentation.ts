import type { AnalysisResult } from "@/lib/api";
import { canonicalCriterionPoints } from "@/lib/canonical-score";
import type { DirectResult } from "@/lib/direct-analysis";

/** Adapt transport data to the existing report; never infer sentence grades. */
export function directAnalysisPresentation(
  result: DirectResult,
): AnalysisResult {
  const accepted = !result.failure && result.decision.status === "ACCEPT";
  const feedback = accepted ? result.coaching.feedback?.trim() : undefined;
  const legacyPoints = canonicalCriterionPoints(result.score);
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
    scoreDetails: result.score.details ?? result.practiceResult?.score.details,
    id: result.sourceIdentity.executionId,
    status: result.failure ? "FAILED" : "COMPLETED",
    outcome: null,
    transcript: null,
    sttConfidence: null,
    overallScore: accepted ? result.score.overallScore : null,
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
      (accepted ? itemFeedback : "") ||
      (result.failure
        ? "분석 근거를 확정하지 못했습니다. 다시 녹음해 주세요."
        : result.decision.status !== "ACCEPT"
          ? "이번 입력은 평가를 완료하지 못했습니다. 녹음과 문장을 확인해 주세요."
          : "제공된 AI 총평이 없습니다."),
    pronunciationEvidence: null,
    visualSupplement: null,
    analyzedAt: null,
    scoreHierarchy:
      result.score.validity === "RUBRIC_COMPUTED" &&
      typeof result.score.rubricRevision === "string" &&
      legacyPoints.length > 0
        ? {
            rubricRevision: result.score.rubricRevision,
            leafCount: 0,
            groups: legacyPoints.map((row) => ({
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
