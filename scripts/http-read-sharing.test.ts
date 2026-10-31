import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import {
  ApiError,
  clearAccessToken,
  createHttpClient,
  saveAccessToken,
} from "../src/lib/api/client";

const originalFetch = globalThis.fetch;
beforeEach(() => saveAccessToken("current-session"));
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function response(data: unknown = {}, status = 200) {
  return new Response(
    JSON.stringify({ result: status === 200, message: "test", data }),
    { status, headers: { "content-type": "application/json" } },
  );
}

test("simultaneous screen reads share a request and later visits revalidate", async () => {
  const pending = deferred<Response>();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1 ? pending.promise : response({ nickname: "updated" });
  };
  const client = createHttpClient("");
  const a = client.request("/api/users/me");
  const b = client.request("/api/users/me", { method: "GET" });
  assert.equal(a, b);
  assert.equal(calls, 1);
  pending.resolve(response({ nickname: "first" }));
  assert.deepEqual(await a, { nickname: "first" });
  assert.deepEqual(await b, { nickname: "first" });
  assert.deepEqual(await client.request("/api/users/me"), {
    nickname: "updated",
  });
  assert.equal(calls, 2);
});

test("failed shared reads release their flight for retry", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response({}, calls === 1 ? 503 : 200);
  };
  const client = createHttpClient("");
  const a = client.request("/api/users/me/title");
  const b = client.request("/api/users/me/title");
  await Promise.all([
    assert.rejects(
      a,
      (error: unknown) => error instanceof ApiError && error.status === 503,
    ),
    assert.rejects(
      b,
      (error: unknown) => error instanceof ApiError && error.status === 503,
    ),
  ]);
  await client.request("/api/users/me/title");
  assert.equal(calls, 2);
});

test("different filters and HTTP clients do not share their responses", async () => {
  const pending = [
    deferred<Response>(),
    deferred<Response>(),
    deferred<Response>(),
  ];
  let calls = 0;
  globalThis.fetch = async () => pending[calls++].promise;
  const client = createHttpClient("/api/backend");
  const a = client.request("/api/contents?category=A");
  const b = client.request("/api/contents?category=B");
  const c = createHttpClient("https://other.test").request(
    "/api/contents?category=A",
  );
  assert.equal(calls, 3);
  pending.forEach((flight, index) => flight.resolve(response({ index })));
  assert.deepEqual(await Promise.all([a, b, c]), [
    { index: 0 },
    { index: 1 },
    { index: 2 },
  ]);
});

test("custom headers, timeouts and no-store reads retain separate lifecycles", async () => {
  let calls = 0;
  globalThis.fetch = async () => response({ call: ++calls });
  const client = createHttpClient("");
  const results = await Promise.all([
    client.request("/same"),
    client.request("/same", { headers: { "X-View": "details" } }),
    client.request("/same", { timeoutMs: 500 }),
    client.request("/same", { cache: "no-store" }),
  ]);
  assert.equal(calls, 4);
  assert.deepEqual(results, [
    { call: 1 },
    { call: 2 },
    { call: 3 },
    { call: 4 },
  ]);
});

test("cancelling one reader does not cancel another screen's default read", async () => {
  const pending = deferred<Response>();
  let calls = 0;
  globalThis.fetch = async (_input, options) => {
    calls++;
    if (calls > 1) return pending.promise;
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener(
        "abort",
        () => {
          reject(new DOMException("cancelled", "AbortError"));
        },
        { once: true },
      );
    });
  };
  const client = createHttpClient("");
  const controller = new AbortController();
  const cancelled = assert.rejects(
    client.request("/same", { signal: controller.signal }),
    (error: unknown) =>
      error instanceof ApiError && error.code === "REQUEST_ABORTED",
  );
  const other = client.request("/same");
  controller.abort();
  pending.resolve(response({ ok: true }));
  await cancelled;
  assert.deepEqual(await other, { ok: true });
  assert.equal(calls, 2);
});

test("new login cannot receive an old account's shared result", async () => {
  const old = deferred<Response>();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1 ? old.promise : response({ user: "new" });
  };
  const client = createHttpClient("");
  const previous = assert.rejects(
    client.request("/api/users/me"),
    (error: unknown) =>
      error instanceof ApiError && error.code === "AUTH_SESSION_CHANGED",
  );
  saveAccessToken("new-session");
  assert.deepEqual(await client.request("/api/users/me"), { user: "new" });
  old.resolve(response({ user: "old" }));
  await previous;
  assert.equal(calls, 2);
});

test("writes invalidate reads both before and during the mutation", async () => {
  const reads = [
    deferred<Response>(),
    deferred<Response>(),
    deferred<Response>(),
  ];
  const mutation = deferred<Response>();
  let readCount = 0;
  globalThis.fetch = async (_input, options) =>
    options?.method === "PATCH" ? mutation.promise : reads[readCount++].promise;
  const client = createHttpClient("");
  const before = client.request("/api/users/me");
  const write = client.request("/api/users/me", {
    method: "PATCH",
    body: { nickname: "new" },
  });
  const during = client.request("/api/users/me");
  mutation.resolve(response());
  await write;
  const after = client.request("/api/users/me");
  assert.equal(readCount, 3);
  reads[0].resolve(response({ nickname: "old" }));
  reads[1].resolve(response({ nickname: "before-commit" }));
  await Promise.all([before, during]);
  assert.equal(
    client.request("/api/users/me"),
    after,
    "late reads must not clear the fresh flight",
  );
  reads[2].resolve(response({ nickname: "new" }));
  assert.deepEqual(await after, { nickname: "new" });
});

test("POST actions are always sent individually", async () => {
  let calls = 0;
  globalThis.fetch = async () => response({ id: ++calls });
  const client = createHttpClient("");
  const results = await Promise.all([
    client.request("/api/training-sessions", { method: "POST", body: {} }),
    client.request("/api/training-sessions", { method: "POST", body: {} }),
  ]);
  assert.deepEqual(results, [{ id: 1 }, { id: 2 }]);
});

test("shared 401 reads refresh once and complete without joining themselves", async () => {
  let calls = 0;
  globalThis.fetch = async (input, options) => {
    calls++;
    if (String(input).endsWith("/token/refresh")) {
      return response({
        accessToken: "renewed",
        tokenType: "Bearer",
        expiresIn: 600,
      });
    }
    return new Headers(options?.headers).get("authorization") ===
      "Bearer renewed"
      ? response({ ok: true })
      : response({}, 401);
  };
  const client = createHttpClient("");
  const a = client.request("/api/users/me");
  const b = client.request("/api/users/me");
  assert.deepEqual(await Promise.all([a, b]), [{ ok: true }, { ok: true }]);
  assert.equal(calls, 3);
});
