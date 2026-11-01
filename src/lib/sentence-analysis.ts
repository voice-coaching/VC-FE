import { api } from "./api";
import { ApiError, getAuthSessionVersion } from "./api/client";
import { waitForCanonicalResult } from "./canonical-result-wait";
import { canonicalPresentation } from "./canonical-presentation";
import {
  awaitCanonicalPersistence,
  completeCanonicalPractice,
  persistencePending,
} from "./canonical-persistence";
import type {
  SentenceAnalysisAdmission,
  SentencePracticeItem,
} from "./sentence-sequence";
import type { AnalysisResult } from "./api";
import { assertSentenceSession } from "./sentence-sequence";

/** An admitted sentence is read/completed independently of the currently recording sentence. */
export async function observeSentenceAnalysis(
  admission: SentenceAnalysisAdmission,
  item: SentencePracticeItem,
  signal: AbortSignal,
  onResult?: (result: AnalysisResult) => void,
) {
  const epoch = getAuthSessionVersion();
  const active = () => !signal.aborted && epoch === getAuthSessionVersion();
  const session = await api.training.get(admission.sessionId);
  if (!active())
    throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
  assertSentenceSession(session, admission, item);
  let result = await waitForCanonicalResult({
    ...admission,
    signal,
    onProgress: () => {},
    onConnectionChange: () => {},
  });
  if (!active()) throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
  // Feedback visibility and persisted practice completion are separate contracts.
  if (result.canonical?.canonicalAnalysis) onResult?.(result);
  if (result.canonical && persistencePending(result.canonical)) {
    const committed = await awaitCanonicalPersistence(
      result.canonical,
      signal,
      () => {},
    );
    result = canonicalPresentation(committed);
  }
  if (!active())
    throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
  if (
    !result.canonical ||
    !(await completeCanonicalPractice(
      api,
      admission.sessionId,
      result.canonical,
      active,
    ))
  )
    throw new ApiError(
      "분석 결과의 저장·완료 상태를 확인해 주세요.",
      409,
      "CANONICAL_RESULT_UNAVAILABLE",
    );
  return result;
}
