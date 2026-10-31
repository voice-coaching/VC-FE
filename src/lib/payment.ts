import { ApiError } from "./api/client";
import type { PaymentOrderStatus } from "./api/types";

export const paymentActionStatusLabel = {
  UNKNOWN: "확인 필요",
  PENDING: "처리 중",
  SUCCEEDED: "완료",
  FAILED: "처리 실패",
} as const;

export function paymentVerificationMessage(status: PaymentOrderStatus) {
  switch (status) {
    case "PAID":
      return "결제가 확인되어 월간 이용권이 적용됐어요.";
    case "FAILED":
      return "결제가 실패했어요. 내역을 확인한 후 다시 결제해 주세요.";
    case "CANCELLED":
      return "취소된 결제예요. 결제 내역을 확인해 주세요.";
    case "PENDING":
      return "결제 결과를 확인 중이에요. 잠시 후 내역에서 다시 확인해 주세요.";
  }
}

export function normalizePaymentReason(reason: string) {
  // VC-BE rejects ISO control characters and applies the length limit before strip().
  if (!reason.trim() || reason.length > 200 || /\p{Cc}/u.test(reason)) {
    throw new Error("사유를 줄바꿈 없이 1~200자로 입력해 주세요.");
  }
  return reason.trim();
}

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
    if (signal?.aborted)
      throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
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
  if (reason.code === "MEMBERSHIP_ALREADY_ACTIVE")
    return "이미 이용 중인 월간 이용권이 있어요. 만료 후 다시 결제할 수 있어요.";
  if (reason.code === "PAYMENT_NOT_CANCELLABLE")
    return "현재 취소·환불할 수 없는 결제예요. 결제 상태를 다시 확인해 주세요.";
  if (reason.code === "INVALID_CANCELLATION_REASON")
    return "사유를 줄바꿈 없이 1~200자로 입력해 주세요.";
  if (reason.code === "PAYMENT_CANCELLATION_UNCONFIRMED")
    return "취소·환불 결과를 확인 중이에요. 같은 사유로 다시 요청하면 기존 요청 상태를 확인할 수 있어요.";
  return reason.message || "결제 요청을 처리하지 못했습니다.";
}
