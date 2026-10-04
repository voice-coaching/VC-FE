import { canonicalApi, canonicalDatabaseId } from "./api/canonical";
import { ApiError, getAuthSessionVersion } from "./api/client";
import type { AnalysisProgress, Id } from "./api/types";
import type { CanonicalAnalysisView } from "./canonical-analysis";
import { canonicalPresentation } from "./canonical-presentation";
import { pollAnalysis } from "./analysis-polling";

/** Receive the result on the waiting request; do not poll status then fetch it again. */
export async function waitForCanonicalResult(options: {
  sessionId: Id;
  recordingId: Id;
  analysisId?: Id;
  signal: AbortSignal;
  onProgress: (value: number) => void;
  onConnectionChange: (value: boolean) => void;
}) {
  const epoch = getAuthSessionVersion();
  let progress: AnalysisProgress | undefined;
  let result: CanonicalAnalysisView | undefined;
  let statusObservedAt = 0;
  let attempt:
    Pick<CanonicalAnalysisView, "requestId" | "executionId"> | undefined;
  await pollAnalysis({
    expectedAnalysisId: options.analysisId,
    signal: options.signal,
    onProgress: options.onProgress,
    onConnectionChange: options.onConnectionChange,
    intervalMs: 0,
    getStatus: async (signal) => {
      // Read the server deadline until a claim has assigned it. Never extend it locally.
      if (!progress || !progress.deadlineAt) {
        progress = await canonicalApi.status(options.sessionId, signal);
        statusObservedAt = performance.now();
        if (
          options.analysisId != null &&
          String(progress.analysisId) !== String(options.analysisId)
        )
          throw new ApiError(
            "분석 시도가 변경되었습니다.",
            409,
            "CANONICAL_ATTEMPT_CHANGED",
          );
      }
      const started = performance.now();
      const view = await canonicalApi.get(
        {
          analysisId: canonicalDatabaseId(progress.analysisId),
          recordingId: canonicalDatabaseId(options.recordingId),
          ...attempt,
        },
        signal,
        8,
      );
      attempt ??= { requestId: view.requestId, executionId: view.executionId };
      const terminal = ["COMPLETED", "FAILED"].includes(view.jobStatus);
      if (terminal) result = view;
      // Old servers ignore waitSeconds. Throttle only their pending responses, never a result.
      if (!terminal && performance.now() - started < 500) {
        await new Promise<void>((resolve, reject) => {
          const cancel = () => {
            clearTimeout(timer);
            reject(signal.reason);
          };
          const timer = setTimeout(() => {
            signal.removeEventListener("abort", cancel);
            resolve();
          }, 1000);
          signal.addEventListener("abort", cancel, { once: true });
          if (signal.aborted) cancel();
        });
      }
      const observedServerTime = progress.serverTime
        ? Date.parse(progress.serverTime)
        : undefined;
      if (
        observedServerTime !== undefined &&
        !Number.isFinite(observedServerTime)
      )
        throw new ApiError(
          "분석 제한 시간 응답이 올바르지 않습니다.",
          502,
          "ANALYSIS_STATUS_INVALID",
        );
      const snapshot = {
        ...progress,
        serverTime:
          observedServerTime !== undefined
            ? new Date(
                observedServerTime + performance.now() - statusObservedAt,
              ).toISOString()
            : undefined,
        status: view.jobStatus,
        resultAvailable: terminal,
        progressPercent: terminal ? 100 : progress.progressPercent,
      };
      // Remaining time must be measured from when the status was fetched, not each long poll.
      progress = { ...progress, serverTime: undefined };
      return snapshot;
    },
  });
  if (options.signal.aborted || epoch !== getAuthSessionVersion())
    throw new ApiError(
      "로그인 상태 또는 요청이 변경되었습니다.",
      499,
      "REQUEST_ABORTED",
    );
  if (!result)
    throw new ApiError(
      "분석 결과를 확인할 수 없습니다.",
      502,
      "CANONICAL_RESULT_UNAVAILABLE",
    );
  return canonicalPresentation(result);
}
