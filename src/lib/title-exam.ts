import type { ApiContract, Id } from "./api/types";

export async function prepareTitleExam(
  api: Pick<ApiContract, "users">,
  returnTo: string,
  idempotencyKey: string,
) {
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
