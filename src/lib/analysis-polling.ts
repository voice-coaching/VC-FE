import type { AnalysisProgress } from "./api/types";
import {
  ApiError,
  getAuthSessionVersion,
  subscribeAuthSession,
} from "./api/client";

export class AnalysisWaitTimeout extends Error {
  constructor(readonly analysisId?: string) {
    super(
      "분석이 예상보다 오래 걸리고 있습니다. 녹음을 다시 보내지 않고 분석 상태를 다시 확인할 수 있습니다.",
    );
    this.name = "AnalysisWaitTimeout";
  }
}
export class AnalysisConnectionUnavailable extends Error {
  constructor(readonly analysisId?: string) {
    super(
      "분석 상태를 확인하지 못했습니다. 녹음을 다시 보내지 않고 상태를 다시 확인해 주세요.",
    );
    this.name = "AnalysisConnectionUnavailable";
  }
}
export class AnalysisFailed extends Error {}

function transient(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    ([502, 503, 504].includes(error.upstreamStatus ?? 0) ||
      (error.status === 0 && error.code === "NETWORK_ERROR") ||
      (error.status === 408 && error.code === "TIMEOUT"))
  );
}
function aborted() {
  return new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
}
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? aborted());
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason ?? aborted());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

/** Only repeats status reads. Never submits a job or resets the overall deadline. */
export async function pollAnalysis({
  getStatus,
  onProgress,
  onConnectionChange,
  signal,
  expectedAnalysisId,
  timeoutMs = 600_000,
  intervalMs = 1_000,
}: {
  getStatus: (signal: AbortSignal) => Promise<AnalysisProgress>;
  onProgress: (progress: number) => void;
  onConnectionChange?: (recovering: boolean) => void;
  signal?: AbortSignal;
  expectedAnalysisId?: string | number;
  timeoutMs?: number;
  intervalMs?: number;
}) {
  const now = () => performance.now();
  let deadline = now() + timeoutMs;
  let serverDeadline: string | undefined;
  const owner = new AbortController();
  const cancel = () => owner.abort(signal?.reason ?? aborted());
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const epoch = getAuthSessionVersion();
  const unsubscribe = subscribeAuthSession(() => {
    if (epoch !== getAuthSessionVersion())
      owner.abort(
        new ApiError(
          "로그인 상태가 변경되었습니다.",
          409,
          "AUTH_SESSION_CHANGED",
        ),
      );
  });
  let outageDeadline: number | undefined;
  let failures = 0;
  let analysisId =
    expectedAnalysisId === undefined ? undefined : String(expectedAnalysisId);
  try {
    while (now() < deadline) {
      if (owner.signal.aborted) throw owner.signal.reason;
      if (outageDeadline !== undefined && now() >= outageDeadline)
        throw new AnalysisConnectionUnavailable(analysisId);
      const request = new AbortController();
      const stopRequest = () => request.abort(owner.signal.reason);
      owner.signal.addEventListener("abort", stopRequest, { once: true });
      const budget = Math.min(
        20_000,
        deadline - now(),
        (outageDeadline ?? Infinity) - now(),
      );
      const timer = setTimeout(
        () =>
          request.abort(
            new ApiError("요청 시간이 초과되었습니다.", 408, "TIMEOUT"),
          ),
        Math.max(0, budget),
      );
      let rejectAbort: (() => void) | undefined;
      let status: AnalysisProgress;
      try {
        status = await Promise.race([
          getStatus(request.signal),
          new Promise<never>((_, reject) => {
            rejectAbort = () => reject(request.signal.reason ?? aborted());
            request.signal.addEventListener("abort", rejectAbort, {
              once: true,
            });
            if (request.signal.aborted) rejectAbort();
          }),
        ]);
      } catch (error) {
        if (owner.signal.aborted) throw owner.signal.reason;
        const failure = request.signal.aborted ? request.signal.reason : error;
        if (!transient(failure)) throw failure;
        outageDeadline ??= now() + 90_000;
        onConnectionChange?.(true);
        const remaining = Math.min(deadline, outageDeadline) - now();
        if (remaining <= 0) throw new AnalysisConnectionUnavailable(analysisId);
        const backoff =
          Math.min(8_000, 1_000 * 2 ** Math.min(failures++, 3)) *
          (0.8 + Math.random() * 0.4);
        await pause(
          Math.min(remaining, Math.max(backoff, failure.retryAfterMs ?? 0)),
          owner.signal,
        );
        continue;
      } finally {
        clearTimeout(timer);
        owner.signal.removeEventListener("abort", stopRequest);
        if (rejectAbort)
          request.signal.removeEventListener("abort", rejectAbort);
      }
      if (owner.signal.aborted) throw owner.signal.reason;
      if (
        !status ||
        !["PENDING", "PROCESSING", "COMPLETED", "FAILED"].includes(
          status.status,
        ) ||
        !["number", "string"].includes(typeof status.analysisId) ||
        !/^[1-9][0-9]*$/.test(String(status.analysisId)) ||
        !Number.isSafeInteger(Number(status.analysisId)) ||
        !Number.isFinite(status.progressPercent) ||
        status.progressPercent < 0 ||
        status.progressPercent > 100
      )
        throw new ApiError(
          "분석 상태 응답이 올바르지 않습니다.",
          502,
          "ANALYSIS_STATUS_INVALID",
        );
      if (analysisId !== undefined && analysisId !== String(status.analysisId))
        throw new ApiError(
          "분석 시도가 변경되었습니다. 상태를 다시 확인해 주세요.",
          409,
          "CANONICAL_ATTEMPT_CHANGED",
        );
      analysisId = String(status.analysisId);
      outageDeadline = undefined;
      failures = 0;
      onConnectionChange?.(false);
      onProgress(status.progressPercent);
      if (status.status === "COMPLETED") return status.analysisId;
      if (status.status === "FAILED")
        throw new AnalysisFailed(
          status.failureReason || "음성 분석에 실패했습니다.",
        );
      if (
        typeof status.deadlineAt === "string" &&
        typeof status.serverTime === "string"
      ) {
        const remaining =
          Date.parse(status.deadlineAt) - Date.parse(status.serverTime);
        if (
          !Number.isFinite(remaining) ||
          (serverDeadline !== undefined && serverDeadline !== status.deadlineAt)
        )
          throw new ApiError(
            "분석 제한 시간 응답이 올바르지 않습니다.",
            502,
            "ANALYSIS_STATUS_INVALID",
          );
        // Use server-relative time, not the device clock. Freeze on first read;
        // reconnecting never changes the server's execution deadline.
        if (serverDeadline === undefined) {
          serverDeadline = status.deadlineAt;
          deadline =
            now() + Math.min(3_600_000, Math.max(0, remaining)) + 5_000;
        }
      }
      await pause(
        Math.min(intervalMs, Math.max(0, deadline - now())),
        owner.signal,
      );
    }
    if (outageDeadline !== undefined)
      throw new AnalysisConnectionUnavailable(analysisId);
    throw new AnalysisWaitTimeout(analysisId);
  } finally {
    unsubscribe();
    signal?.removeEventListener("abort", cancel);
  }
}
