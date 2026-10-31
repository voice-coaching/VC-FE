import { ApiError } from "./api/client";

type PaymentRetryOptions = {
  maxRetries?: number;
  onRateLimit?: (remainingSeconds: number) => void;
  signal?: AbortSignal;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
};

function wait(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED"));
      return;
    }
    const abort = () => {
      clearTimeout(timeout);
      reject(new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function runPaymentRequest<T>(
  operation: () => Promise<T>,
  {
    maxRetries = 1,
    onRateLimit,
    signal,
    wait: waitForRetry = wait,
  }: PaymentRetryOptions = {},
) {
  let retries = 0;
  while (true) {
    try {
      return await operation();
    } catch (reason) {
      if (
        !(reason instanceof ApiError) ||
        reason.status !== 429 ||
        reason.retryAfterMs === undefined ||
        retries >= maxRetries
      ) {
        throw reason;
      }
      retries += 1;
      onRateLimit?.(Math.max(1, Math.ceil(reason.retryAfterMs / 1_000)));
      await waitForRetry(reason.retryAfterMs, signal);
    }
  }
}

export function paymentErrorMessage(reason: unknown) {
  if (!(reason instanceof ApiError)) {
    return reason instanceof Error
      ? reason.message
      : "결제 요청을 처리하지 못했습니다.";
  }
  if (reason.status === 429) {
    const seconds = reason.retryAfterMs
      ? Math.max(1, Math.ceil(reason.retryAfterMs / 1_000))
      : null;
    return seconds
      ? `${seconds}초 후 다시 시도해 주세요.`
      : "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (reason.status === 503) {
    return "결제 상태 확인이 잠시 불안정합니다. 중복 결제하지 말고 잠시 후 다시 확인해 주세요.";
  }
  if (reason.status === 403 && reason.code === "TEST_PAYMENT_DISABLED") {
    return "현재 테스트 결제 기능이 비활성화되어 있습니다.";
  }
  return reason.message || "결제 요청을 처리하지 못했습니다.";
}
