import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  ApiError,
  clearAccessToken,
  createHttpClient,
  getAccessToken,
  saveAccessToken,
} from "../src/lib/api/client";
import {
  getAuthSessionSnapshot,
  markAuthenticatedSession,
  resetAuthSession,
} from "../src/lib/auth-session";
import { createRemoteApi } from "../src/lib/api/remote";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
  resetAuthSession();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function response(status = 200, data: unknown = {}, headers = {}) {
  return new Response(
    JSON.stringify({ result: status === 200, message: "test", data }),
    {
      status,
      headers: { "content-type": "application/json", ...headers },
    },
  );
}
const refreshed = {
  accessToken: "renewed",
  tokenType: "Bearer",
  expiresIn: 600,
};
function login(token = "expired") {
  saveAccessToken(token);
  markAuthenticatedSession({
    accessToken: token,
    tokenType: "Bearer",
    expiresIn: 600,
    onboardingRequired: false,
    user: { id: token, nickname: "test" },
  });
}
const changed = (error: unknown) =>
  error instanceof ApiError && error.code === "AUTH_SESSION_CHANGED";

test("late 401 reuses the refreshed token without a second refresh", async () => {
  login();
  const late = deferred<Response>();
  let refreshes = 0;
  globalThis.fetch = (async (url, init) => {
    if (String(url).endsWith("/token/refresh")) {
      refreshes++;
      return response(200, refreshed);
    }
    if (new Headers(init?.headers).get("authorization") === "Bearer expired") {
      return String(url).endsWith("/slow") ? late.promise : response(401);
    }
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer renewed",
    );
    return response();
  }) as typeof fetch;
  const client = createHttpClient("https://example.test");
  const slow = client.request("/slow");
  await client.request("/fast");
  late.resolve(response(401));
  await slow;
  assert.equal(refreshes, 1);
});

test("simultaneous requests and explicit refresh share one refresh", async () => {
  login();
  const pending = deferred<Response>();
  const started = deferred<void>();
  let refreshes = 0;
  globalThis.fetch = (async (url, init) => {
    assert.equal(init?.credentials, "include");
    if (String(url).endsWith("/token/refresh")) {
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      refreshes++;
      started.resolve();
      return pending.promise;
    }
    return new Headers(init?.headers).get("authorization") === "Bearer expired"
      ? response(401)
      : response();
  }) as typeof fetch;
  const api = createRemoteApi("https://example.test");
  const a = api.users.getTitle();
  const b = api.users.getTitle();
  await started.promise;
  const manual = api.auth.refresh();
  pending.resolve(response(200, refreshed));
  await Promise.all([a, b, manual]);
  assert.equal(refreshes, 1);
});

for (const status of [200, 401]) {
  for (const nextSession of ["login", "logout"] as const) {
    test(`old refresh ${status} cannot overwrite ${nextSession}`, async () => {
      login();
      const pending = deferred<Response>();
      const started = deferred<void>();
      let requests = 0;
      globalThis.fetch = (async (url) => {
        requests++;
        if (String(url).endsWith("/token/refresh")) {
          started.resolve();
          return pending.promise;
        }
        return response(401);
      }) as typeof fetch;
      const client = createHttpClient("https://example.test");
      const result = assert.rejects(client.request("/private"), changed);
      await started.promise;
      if (nextSession === "login") login("new-session");
      else clearAccessToken();
      pending.resolve(response(status, refreshed));
      await result;
      assert.equal(
        getAccessToken(),
        nextSession === "login" ? "new-session" : null,
      );
      assert.equal(
        requests,
        2,
        "old operations must not retry under the new session",
      );
    });
  }
}

test("late retry 401 cannot delete a newly authenticated session", async () => {
  login();
  const late = deferred<Response>();
  globalThis.fetch = (() => late.promise) as typeof fetch;
  const client = createHttpClient("https://example.test");
  const result = assert.rejects(
    client.request("/private", { skipRefresh: true }),
    changed,
  );
  login("new-session");
  late.resolve(response(401));
  await result;
  assert.equal(getAccessToken(), "new-session");
  assert.equal(getAuthSessionSnapshot().status, "authenticated");
});

test("expired refresh cookie clears the current session and does not loop", async () => {
  login();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return response(401);
  }) as typeof fetch;
  await assert.rejects(
    createHttpClient("").request("/private"),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(calls, 2);
  assert.equal(getAccessToken(), null);
  assert.equal(getAuthSessionSnapshot().status, "anonymous");
});

test("refresh network failure keeps the session available for retry", async () => {
  login();
  globalThis.fetch = (async (url) => {
    if (String(url).endsWith("/token/refresh")) throw new TypeError("offline");
    return response(401);
  }) as typeof fetch;
  await assert.rejects(
    createHttpClient("").request("/private"),
    (error: unknown) =>
      error instanceof ApiError && error.code === "NETWORK_ERROR",
  );
  assert.equal(getAccessToken(), "expired");
  assert.equal(getAuthSessionSnapshot().status, "authenticated");
});

test("retry is limited to once if the new token also gets 401", async () => {
  login();
  let calls = 0;
  globalThis.fetch = (async (url) => {
    calls++;
    return String(url).endsWith("/token/refresh")
      ? response(200, refreshed)
      : response(401);
  }) as typeof fetch;
  await assert.rejects(createHttpClient("").request("/private"));
  assert.equal(calls, 3);
  assert.equal(getAccessToken(), null);
});

test("a failed public login does not log out an existing session", async () => {
  login("current");
  globalThis.fetch = (async () => response(401)) as typeof fetch;
  await assert.rejects(
    createHttpClient("").request("/api/auth/login", { skipAuth: true }),
  );
  assert.equal(getAccessToken(), "current");
});

test("a late logout response does not clear a new login", async () => {
  login();
  const late = deferred<Response>();
  globalThis.fetch = (() => late.promise) as typeof fetch;
  const result = assert.rejects(createRemoteApi("").auth.signOut(), changed);
  login("new-session");
  late.resolve(response());
  await result;
  assert.equal(getAccessToken(), "new-session");
});

test("a late token header cannot roll back an already renewed token", async () => {
  login();
  const late = deferred<Response>();
  globalThis.fetch = (async (url) =>
    String(url).endsWith("/slow")
      ? late.promise
      : response(200, {}, { "x-new-access-token": "newer" })) as typeof fetch;
  const client = createHttpClient("");
  const slow = client.request("/slow");
  await client.request("/fast");
  late.resolve(response(200, {}, { "x-new-access-token": "older" }));
  await slow;
  assert.equal(getAccessToken(), "newer");
});
