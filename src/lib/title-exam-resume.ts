import type { ApiContract, Id } from "./api/types";
import { ApiError } from "./api/client";
import { loadPracticeResume } from "./practice-resume";
import { createTitleExamSession } from "./title-exam";

/** Resume the exam's current link; an old URL is not the session authority. */
export async function loadTitleExamResume(
  api: Pick<ApiContract, "users" | "training">,
  examId: Id,
  contentId: Id,
  isCurrent: () => boolean = () => true,
  idempotencyKey?: string,
) {
  const requireCurrent = () => {
    if (!isCurrent())
      throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
  };
  requireCurrent();
  const exam = await api.users.getTitleExam(examId);
  requireCurrent();
  if (
    String(exam.id) !== String(examId) ||
    String(exam.practiceContentId) !== String(contentId)
  )
    throw new Error(
      "시험과 연습 콘텐츠가 일치하지 않습니다. 마이페이지에서 시험을 다시 열어 주세요.",
    );
  const linked =
    exam.trainingSessionId ??
    (await createTitleExamSession(
      api,
      examId,
      contentId,
      isCurrent,
      idempotencyKey,
    ));
  requireCurrent();
  try {
    return await loadPracticeResume(api, linked, contentId, true);
  } catch (reason) {
    if (
      !(reason instanceof ApiError) ||
      reason.code !== "ANALYSIS_RECORDING_MISSING"
    )
      throw reason;
    requireCurrent();
    // Only the server can rebind an ungraded, unusable exam session. Never
    // cancel an unknown analysis or start uploading into an invalid session.
    const resolved = await createTitleExamSession(
      api,
      examId,
      contentId,
      isCurrent,
      idempotencyKey,
    );
    requireCurrent();
    if (String(resolved) === String(linked)) throw reason;
    return loadPracticeResume(api, resolved, contentId, true);
  }
}
