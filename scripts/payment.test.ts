import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { ApiError } from "../src/lib/api/client";
import { createRemoteApi } from "../src/lib/api/remote";
import { runPaymentRequest } from "../src/lib/payment";

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
