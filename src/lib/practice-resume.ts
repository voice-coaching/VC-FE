import type { ApiContract, Id, VoiceRecording } from "./api/types";
import { ApiError } from "./api/client";

type ResumeState = {
  phase: "idle" | "analyzing";
  sessionId: Id | null;
  attempts: VoiceRecording[];
  selectedRecordingId: Id | null;
  completed: boolean;
};

/** A linked session does not imply that a recording or an analysis exists. */
export async function loadPracticeResume(
  api: Pick<ApiContract, "training">,
  sessionId: Id,
  contentId: Id,
  titleExam = false,
): Promise<ResumeState> {
  const [session, attempts] = await Promise.all([
    api.training.get(sessionId),
    api.training.listRecordings(sessionId),
  ]);
  const sessionContentId = session.content?.id ?? session.contentId;
  if (
    sessionContentId != null &&
    String(sessionContentId) !== String(contentId)
  )
    throw new Error("이어갈 학습과 현재 콘텐츠가 일치하지 않습니다.");

  // The backend rebinds an ungraded exam when its prior session was cancelled
  // or failed. Do not upload to that finished session again.
  if (titleExam && ["CANCELED", "FAILED"].includes(session.status))
    return {
      phase: "idle",
      sessionId: null,
      attempts: [],
      selectedRecordingId: null,
      completed: false,
    };

  const selected = attempts.find((item) => item.selected);
  const selectedRecordingId =
    session.selectedRecordingId ??
    selected?.recordingId ??
    selected?.id ??
    null;
  if (
    ["RECORDING", "UPLOADING"].includes(session.status) &&
    session.analysisAvailable !== true
  )
    return {
      phase: "idle",
      sessionId,
      attempts,
      selectedRecordingId,
      completed: false,
    };

  if (selectedRecordingId == null)
    throw new ApiError(
      "기존 분석에 연결된 녹음을 확인하지 못했어요. 학습 상태를 다시 확인해 주세요.",
      409,
      "ANALYSIS_RECORDING_MISSING",
    );
  return {
    phase: "analyzing",
    sessionId,
    attempts,
    selectedRecordingId,
    completed: session.status === "COMPLETED",
  };
}
