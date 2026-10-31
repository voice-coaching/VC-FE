import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { ApiError, clearAccessToken } from "../src/lib/api/client";
import { createRemoteApi } from "../src/lib/api/remote";
import {
  normalizePaymentReason,
  paymentErrorMessage,
  paymentVerificationMessage,
  runPaymentRequest,
} from "../src/lib/payment";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("payment requests wait for Retry-After and retry once", async () => {
  let calls = 0;
  let waited = 0;
  let reportedSeconds = 0;
  const result = await runPaymentRequest(
    async () => {
      calls += 1;
      if (calls === 1)
        throw new ApiError(
          "rate limited",
          429,
          "PAYMENT_RATE_LIMITED",
          undefined,
          2_500,
        );
      return "paid";
    },
    {
      wait: async (milliseconds) => {
        waited = milliseconds;
      },
      onRateLimit: (seconds) => {
        reportedSeconds = seconds;
      },
    },
  );

  assert.equal(result, "paid");
  assert.equal(calls, 2);
  assert.equal(waited, 2_500);
  assert.equal(reportedSeconds, 3);
});

test("payment requests do not automatically retry 503", async () => {
  let calls = 0;
  await assert.rejects(
    runPaymentRequest(async () => {
      calls += 1;
      throw new ApiError("unavailable", 503, "PAYMENT_RATE_LIMIT_UNAVAILABLE");
    }),
    (reason: unknown) => reason instanceof ApiError && reason.status === 503,
  );
  assert.equal(calls, 1);
});

test("an aborted payment request never performs a mutation", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    runPaymentRequest(
      async () => {
        calls += 1;
      },
      {
        signal: controller.signal,
      },
    ),
    (reason: unknown) =>
      reason instanceof ApiError && reason.code === "REQUEST_ABORTED",
  );
  assert.equal(calls, 0);
});

test("cancellation while rate limited prevents the retry from reaching the backend", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    runPaymentRequest(
      async () => {
        calls += 1;
        throw new ApiError(
          "rate limited",
          429,
          "PAYMENT_RATE_LIMITED",
          undefined,
          1,
        );
      },
      {
        signal: controller.signal,
        wait: async () => {
          controller.abort();
        },
      },
    ),
    (reason: unknown) =>
      reason instanceof ApiError && reason.code === "REQUEST_ABORTED",
  );
  assert.equal(calls, 1);
});

test("cancel and refund reasons follow the backend's UTF-16 length and ISO control rules", () => {
  assert.equal(normalizePaymentReason("  테스트 환불  "), "테스트 환불");
  assert.equal(normalizePaymentReason("가".repeat(200)).length, 200);
  for (const reason of [
    " ",
    "가".repeat(201),
    "환불\n신청",
    "취소\t사유",
    "사유\u0085",
  ]) {
    assert.throws(() => normalizePaymentReason(reason), /줄바꿈 없이 1~200자/);
  }
});

test("terminal payment states and active-membership errors do not claim processing is pending", () => {
  assert.match(paymentVerificationMessage("FAILED"), /실패/);
  assert.match(paymentVerificationMessage("CANCELLED"), /취소/);
  assert.match(
    paymentErrorMessage(
      new ApiError(
        "MEMBERSHIP_ALREADY_ACTIVE",
        409,
        "MEMBERSHIP_ALREADY_ACTIVE",
      ),
    ),
    /만료 후/,
  );
});

test("concurrent payment history reads share one backend request", async () => {
  let requests = 0;
  let resolveFetch: ((response: Response) => void) | undefined;
  globalThis.fetch = async () => {
    requests += 1;
    return new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
  };
  const api = createRemoteApi("/api/backend");
  const first = api.payments.listOrders({ page: 0, size: 20 });
  const second = api.payments.listOrders({ page: 0, size: 20 });
  assert.equal(requests, 1);
  resolveFetch?.(
    Response.json({
      result: true,
      message: "ok",
      data: {
        items: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
      },
    }),
  );
  assert.deepEqual(await first, await second);
});

test("a new login session does not reuse the previous session's payment history request", async () => {
  const responses: Array<(response: Response) => void> = [];
  globalThis.fetch = async () =>
    new Promise<Response>((resolve) => responses.push(resolve));
  const api = createRemoteApi("/api/backend");
  const first = api.payments.listOrders();
  const previous = assert.rejects(
    first,
    (reason: unknown) =>
      reason instanceof ApiError && reason.code === "AUTH_SESSION_CHANGED",
  );
  clearAccessToken();
  const second = api.payments.listOrders();
  assert.equal(responses.length, 2);
  responses[0](
    Response.json({ result: true, data: { items: [{ orderId: "old" }] } }),
  );
  responses[1](
    Response.json({ result: true, data: { items: [{ orderId: "current" }] } }),
  );
  await previous;
  assert.equal((await second).items[0].orderId, "current");
});

test("payment adapter matches the published backend contract", async () => {
  const calls: string[] = [];
  const options: RequestInit[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), "https://frontend.example.test");
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    options.push(init ?? {});
    const data =
      url.pathname === "/api/backend/api/users/me/payment-orders"
        ? {
            items: [],
            page: 0,
            size: 20,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
          }
        : url.pathname.includes("refund") || url.pathname.endsWith("/cancel")
          ? {
              requestId: "refund-1",
              orderId: "order-1",
              status: "PENDING",
              requestedAt: "2026-10-29T00:00:00Z",
              updatedAt: "2026-10-29T00:00:00Z",
            }
          : {
              orderId: "order-1",
              product: "MONTHLY_PASS",
              orderName: "월간 이용권",
              totalAmount: 15_000,
              currency: "KRW",
              status: "PENDING",
              environment: "TEST",
              expiresAt: null,
              storeId: "store-test",
              channelKey: "channel-test",
            };
    return Response.json({ result: true, message: "ok", data });
  };

  const api = createRemoteApi("/api/backend");
  await api.payments.createOrder("payment-order-key");
  await api.payments.getOrder("order-1");
  await api.payments.verifyOrder("order-1");
  await api.payments.listOrders({ page: 0, size: 20 });
  await api.payments.cancel("order-1", "결제 취소 테스트");
  await api.payments.requestRefund("order-1", "환불 신청 테스트");
  await api.payments.getRefundRequest("refund-1");

  assert.deepEqual(calls, [
    "POST /api/backend/api/payment-orders",
    "GET /api/backend/api/payment-orders/order-1",
    "POST /api/backend/api/payment-orders/order-1/verify",
    "GET /api/backend/api/users/me/payment-orders?page=0&size=20",
    "POST /api/backend/api/payment-orders/order-1/cancel",
    "POST /api/backend/api/payment-orders/order-1/refund-requests",
    "GET /api/backend/api/refund-requests/refund-1",
  ]);
  assert.equal(
    new Headers(options[0]?.headers).get("idempotency-key"),
    "payment-order-key",
  );
  assert.deepEqual(JSON.parse(String(options[4]?.body)), {
    reason: "결제 취소 테스트",
  });
  assert.deepEqual(JSON.parse(String(options[5]?.body)), {
    reason: "환불 신청 테스트",
  });
});
