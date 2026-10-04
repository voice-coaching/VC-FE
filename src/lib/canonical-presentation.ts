import type { AnalysisResult } from "./api/types";
import type { CanonicalAnalysisView } from "./canonical-analysis";

/** Existing screen model only. Never converts v5 into a legacy API contract. */
export function canonicalPresentation(
  view: CanonicalAnalysisView,
): AnalysisResult {
  const core = view.canonicalAnalysis;
  const coaching = core?.coaching;
  let summary: string;
  if (view.jobStatus === "FAILED") {
    summary =
      core?.score.validity === "UNSCORABLE"
        ? "채점 근거 또는 점수 응답을 확인하지 못했습니다. 임의 점수는 제공하지 않습니다. 다시 분석해 주세요."
        : "분석 처리에 실패했습니다. 시스템 실패를 발음 문제로 해석하지 마세요.";
  } else if (core?.decision.status === "REJECT") {
    summary =
      "입력이 분석 조건을 충족하지 못했습니다. 발음 오류라는 뜻은 아닙니다.";
  } else if (core?.decision.status === "INCONCLUSIVE") {
    summary = "근거가 충분하지 않아 판단을 보류했습니다.";
  } else if (
    core?.feedbackDeliveryAllowed &&
    coaching?.adapterStatus === "READY"
  ) {
    summary = coaching.items
      // H5 validates one short action per candidate on the server. Keep the
      // complete expressions/evidence in canonical; do not expand the summary.
      .map(({ expression }) => expression.action)
      .join("\n");
  } else if (
    core?.decision.status === "ACCEPT" &&
    core.feedbackDeliveryAllowed
  ) {
    summary =
      "이번 분석에서 안내할 수 있는 발음 연습 후보가 없습니다. 모든 발음이 정상이라는 뜻은 아닙니다.";
  } else {
    summary = "현재 제공할 수 있는 분석 피드백이 없습니다.";
  }
  return {
    canonical: view,
    id: view.analysisId,
    status: view.jobStatus,
    outcome: null,
    transcript: null,
    sttConfidence: null,
    overallScore:
      core?.score.validity === "RUBRIC_COMPUTED"
        ? core.score.overallScore
        : null,
    pronunciationScore: null,
    intonationScore: null,
    speedWpm: null,
    speedStatus: null,
    stressScore: null,
    pauseScore: null,
    strengths: [],
    weaknesses: [],
    summaryFeedback: summary,
    pronunciationEvidence: null,
    visualSupplement: null,
    analyzedAt: null,
  };
}

/** Preserve machine status/actions without introducing a separate result UI. */
export class CanonicalResultUnavailable extends Error {
  constructor(readonly view: CanonicalAnalysisView) {
    super(
      view.jobStatus === "FAILED" ||
        view.canonicalAnalysis?.decision.status !== "ACCEPT"
        ? (canonicalPresentation(view).summaryFeedback ??
            "분석 상태를 확인해 주세요.")
        : "분석 결과는 준비됐지만 요청한 작업을 진행할 수 없습니다. 현재 상태를 다시 확인해 주세요.",
    );
    this.name = "CanonicalResultUnavailable";
  }
}
