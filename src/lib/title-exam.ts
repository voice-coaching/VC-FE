import { requireAnalysisScope } from "./api/analysis-capabilities";
import type { ApiContract, Id } from "./api/types";
import { ApiError } from "./api/client";

export function titleExamErrorMessage(reason: unknown) {
  const messages: Record<string, string> = {
    TITLE_EXAM_CONTENT_UNAVAILABLE:
      "승급 시험 문제가 아직 준비되지 않았습니다. 준비가 완료된 후 다시 시도해 주세요.",
    TITLE_EXAM_NOT_ELIGIBLE:
      "승급 시험 응시 횟수가 부족합니다. 마이페이지에서 남은 연습 횟수를 확인해 주세요.",
    MAX_TITLE_REACHED:
      "이미 최고 칭호에 도달했습니다. 마이페이지에서 칭호를 확인해 주세요.",
    TITLE_EXAM_CONTENT_MISMATCH:
      "시험과 연습 콘텐츠가 일치하지 않습니다. 마이페이지에서 시험을 다시 열어 주세요.",
    TITLE_EXAM_ALREADY_GRADED:
      "이미 채점된 시험입니다. 마이페이지에서 칭호를 확인해 주세요.",
    ANALYSIS_NOT_COMPLETED:
      "분석이 아직 완료되지 않아 채점할 수 없습니다. 분석 완료 후 다시 확인해 주세요.",
    ANALYSIS_SCORE_UNAVAILABLE:
      "분석 점수를 확정할 수 없어 승급 채점을 보류했습니다.",
    TEMPORARY_UNAVAILABLE:
      "승급 시험을 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  };
  if (reason instanceof ApiError && messages[reason.code])
    return messages[reason.code];
  return reason instanceof Error
    ? reason.message
    : "승급 시험 요청을 처리하지 못했습니다.";
}

export async function prepareTitleExam(
  api: Pick<ApiContract, "users">,
  returnTo: string,
  idempotencyKey: string,
) {
  await requireAnalysisScope("TITLE_EXAM");
  const created = await api.users.createTitleExam(idempotencyKey);
  // Creation may replay the original READY response for an existing exam.
  const exam = await api.users.getTitleExam(created.id);
  if (String(exam.id) !== String(created.id))
    throw new Error("승급 시험 정보를 확인할 수 없습니다. 다시 시도해 주세요.");
  if (
    ["PASSED", "FAILED"].includes(exam.status) &&
    exam.trainingSessionId == null
  )
    throw new Error("이미 채점된 시험입니다. 칭호 정보를 새로 확인해 주세요.");
  const params = new URLSearchParams({
    titleExamId: String(exam.id),
    returnTo,
    start: "1",
  });
  if (exam.trainingSessionId != null)
    params.set("sessionId", String(exam.trainingSessionId));
  return `/practice/${encodeURIComponent(String(exam.practiceContentId))}?${params}`;
}

export async function createTitleExamSession(
  api: Pick<ApiContract, "users" | "training">,
  examId: Id,
  contentId: Id,
) {
  await requireAnalysisScope("TITLE_EXAM");
  const exam = await api.users.getTitleExam(examId);
  if (String(exam.practiceContentId) !== String(contentId))
    throw new Error(
      "시험 콘텐츠가 변경되었습니다. 마이페이지에서 시험을 다시 열어 주세요.",
    );
  if (["PASSED", "FAILED"].includes(exam.status))
    throw new Error(
      "이미 채점된 시험입니다. 마이페이지에서 결과를 확인해 주세요.",
    );
  if (exam.trainingSessionId != null) return exam.trainingSessionId;
  const session = await api.training.create({
    contentId: exam.practiceContentId,
    titleExamId: exam.id,
    courseStepId: null,
    learningFocus: "PRONUNCIATION",
  });
  const sessionId = session.sessionId ?? session.id;
  if (sessionId == null) throw new Error("학습 세션 ID가 응답에 없습니다.");
  return sessionId;
}
