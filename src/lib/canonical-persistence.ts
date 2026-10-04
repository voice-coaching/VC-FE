import type {
  CanonicalAnalysisView,
  CanonicalViewIdentity,
} from "./canonical-analysis";
import type { ApiContract, Id } from "./api/types";
import { canonicalApi } from "./api/canonical";
import { ApiError, getAuthSessionVersion } from "./api/client";

export function persistencePending(view?: CanonicalAnalysisView | null) {
  return (
    view?.persistenceStatus === "SAVING" ||
    view?.persistenceStatus === "RETRYING"
  );
}

export function resultStillPending(view: CanonicalAnalysisView) {
  return (
    view.jobStatus === "PENDING" ||
    view.jobStatus === "PROCESSING" ||
    persistencePending(view)
  );
}

/** A failed completion command alone does not revoke a valid result. */
export function invalidatesCanonicalResult(error: unknown) {
  return (
    error instanceof ApiError &&
    ([401, 403, 404, 499].includes(error.status) ||
      (error.status === 409 &&
        [
          "CANONICAL_ATTEMPT_CHANGED",
          "CANONICAL_ANALYSIS_CHANGED",
          "CANONICAL_RESULT_UNAVAILABLE",
          "INVALID_SESSION_STATE",
          "RESOURCE_NOT_FOUND",
        ].includes(error.code)))
  );
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

/** Read-only, bounded recovery. Pending after a server restart does not invalidate this attempt's preview. */
export async function awaitCanonicalPersistence(
  expected: CanonicalViewIdentity,
  signal: AbortSignal,
  onSnapshot: (view: CanonicalAnalysisView) => void,
) {
  const epoch = getAuthSessionVersion();
  const deadline = performance.now() + 120_000;
  while (!signal.aborted && performance.now() < deadline) {
    const request = new AbortController();
    const cancel = () => request.abort(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(
      () => request.abort(),
      Math.min(15_000, deadline - performance.now()),
    );
    try {
      const current = await canonicalApi.get(expected, request.signal);
      if (signal.aborted || epoch !== getAuthSessionVersion())
        throw new ApiError(
          "로그인 상태 또는 요청이 변경되었습니다.",
          499,
          "REQUEST_ABORTED",
        );
      if (!resultStillPending(current)) return current;
      onSnapshot(current);
    } catch (error) {
      if (signal.aborted || epoch !== getAuthSessionVersion()) throw error;
      const transient =
        request.signal.aborted ||
        (error instanceof ApiError &&
          [0, 408, 429, 500, 502, 503, 504].includes(error.status));
      if (!transient) throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    }
    await pause(
      Math.min(5_000, Math.max(0, deadline - performance.now())),
      signal,
    );
  }
  if (signal.aborted) throw signal.reason;
  throw new ApiError(
    "결과 저장 상태를 아직 확인하지 못했습니다. 분석을 다시 보내지 않고 저장 상태를 다시 확인해 주세요.",
    408,
    "RESULT_PERSISTENCE_WAIT_TIMEOUT",
  );
}

/** Server-selected recording duration is the same for fresh results, reloads and delayed persistence. */
export async function completeCanonicalPractice(
  api: Pick<ApiContract, "training">,
  sessionId: Id,
  view: CanonicalAnalysisView,
  active: () => boolean = () => true,
) {
  if (!view.actions.canComplete || resultStillPending(view)) return false;
  const recordings = await api.training.listRecordings(sessionId);
  if (!active())
    throw new ApiError("요청이 변경되었습니다.", 499, "REQUEST_ABORTED");
  const recording = recordings.find(
    (item) =>
      item.selected &&
      String(item.recordingId ?? item.id) === String(view.recordingId),
  );
  if (!recording)
    throw new ApiError(
      "선택한 녹음이 변경되었습니다.",
      409,
      "CANONICAL_ATTEMPT_CHANGED",
    );
  if (
    recording.durationMs == null ||
    !Number.isFinite(recording.durationMs) ||
    recording.durationMs <= 0
  )
    throw new ApiError(
      "녹음 길이를 확인하지 못했습니다. 결과를 다시 확인해 주세요.",
      503,
      "RECORDING_DURATION_UNAVAILABLE",
    );
  await api.training.complete(
    sessionId,
    Math.max(1, Math.round(recording.durationMs / 1000)),
    view,
  );
  return true;
}
