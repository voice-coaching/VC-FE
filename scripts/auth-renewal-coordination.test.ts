import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  accessTokenNeedsRefresh,
  clearAccessToken,
  createHttpClient,
  getAccessToken,
  getAuthSessionVersion,
  saveAccessToken,
  subscribeAuthSession,
} from "../src/lib/api/client";

const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);
afterEach(() => {
  clearAccessToken();
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of [
    ["window", originalWindow],
    ["navigator", originalNavigator],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function jwt(sid: string, exp: number, sub = "7") {
  return `header.${Buffer.from(JSON.stringify({ iss: "voice-test", sub, sid, role: "USER", type: "access", exp })).toString("base64url")}.signature`;
}
const json = (data: unknown) => Response.json({ result: true, data });

function browser() {
  const storage = new Map<string, string>();
  let listener: ((event: StorageEvent) => void) | undefined;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      addEventListener: (
        _: string,
        callback: (event: StorageEvent) => void,
      ) => {
        listener = callback;
      },
      removeEventListener: () => {
        listener = undefined;
      },
    },
  });
  return {
    setToken(value: string | null) {
      if (value) storage.set("speakai.access-token", value);
      else storage.delete("speakai.access-token");
    },
    changed() {
      listener?.({ key: "speakai.access-token" } as StorageEvent);
    },
  };
}

test("independent API clients share one proactive token renewal", async () => {
  saveAccessToken(jwt("login", 1));
  let refreshes = 0;
  let release!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const renewed = jwt("login", Math.floor(Date.now() / 1000) + 600);
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/token/refresh")) {
      refreshes++;
      return pending;
    }
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      `Bearer ${renewed}`,
    );
    return json({});
  };
  const first = createHttpClient("/api/backend").request("/api/users/me");
  const second = createHttpClient("/api/backend/").request(
    "/api/training-sessions/141/analysis/status",
  );
  const third = createHttpClient("/api/backend").refreshAccessToken();
  assert.equal(refreshes, 1);
  release(json({ accessToken: renewed, tokenType: "Bearer", expiresIn: 600 }));
  await Promise.all([first, second, third]);
  assert.equal(refreshes, 1);
});

test("another tab's renewal preserves practice state, while new login and logout invalidate it", () => {
  const tab = browser();
  saveAccessToken(jwt("same-login", 100));
  const version = getAuthSessionVersion();
  let changes = 0;
  const unsubscribe = subscribeAuthSession(() => {
    changes++;
  });
  try {
    tab.setToken(jwt("same-login", 200));
    tab.changed();
    assert.equal(getAuthSessionVersion(), version);
    assert.equal(changes, 0);
    tab.changed();
    assert.equal(changes, 0);
    tab.setToken(jwt("new-login", 200));
    tab.changed();
    assert.equal(getAuthSessionVersion(), version + 1);
    tab.setToken(null);
    tab.changed();
    assert.equal(getAuthSessionVersion(), version + 2);
  } finally {
    unsubscribe();
  }
});

test("a queued tab reuses the token persisted by the lock holder without rotating again", async () => {
  const tab = browser();
  saveAccessToken(jwt("login", 1));
  const renewed = jwt("login", Math.floor(Date.now() / 1000) + 600);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (
          _name: string,
          _options: unknown,
          callback: () => unknown,
        ) => {
          tab.setToken(renewed);
          return callback();
        },
      },
    },
  });
  globalThis.fetch = async () => {
    throw new Error("Duplicate renewal must not reach the server");
  };
  const version = getAuthSessionVersion();
  const result = await createHttpClient("/api/backend").refreshAccessToken();
  assert.equal(result.accessToken, renewed);
  assert.equal(getAccessToken(), renewed);
  assert.equal(getAuthSessionVersion(), version);
});

test("a login change while waiting for the lock cannot renew the previous account", async () => {
  const tab = browser();
  saveAccessToken(jwt("old-login", 1));
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (
          _name: string,
          _options: unknown,
          callback: () => unknown,
        ) => {
          tab.setToken(jwt("new-login", 9999999999, "8"));
          return callback();
        },
      },
    },
  });
  globalThis.fetch = async () => {
    throw new Error("Stale account must not renew");
  };
  await assert.rejects(createHttpClient("/api/backend").refreshAccessToken(), {
    code: "AUTH_SESSION_CHANGED",
  });
});

test("fresh access tokens do not need a native foreground renewal", () => {
  assert.equal(
    accessTokenNeedsRefresh(jwt("login", Math.floor(Date.now() / 1000) + 600)),
    false,
  );
  assert.equal(accessTokenNeedsRefresh(jwt("login", 1)), true);
});

test("a WebView that disallows browser locks still renews once", async () => {
  browser();
  saveAccessToken(jwt("login", 1));
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async () => {
          throw new DOMException("unavailable", "SecurityError");
        },
      },
    },
  });
  let refreshes = 0;
  globalThis.fetch = async () => {
    refreshes++;
    return json({
      accessToken: jwt("login", 9999999999),
      tokenType: "Bearer",
      expiresIn: 600,
    });
  };
  await createHttpClient("/api/backend").refreshAccessToken();
  assert.equal(refreshes, 1);
});

test("unavailable localStorage does not prevent an in-memory login from renewing", async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get localStorage() {
        throw new DOMException("unavailable", "SecurityError");
      },
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
  saveAccessToken(jwt("login", 1));
  const renewed = jwt("login", 9999999999);
  globalThis.fetch = async () =>
    json({ accessToken: renewed, tokenType: "Bearer", expiresIn: 600 });
  await createHttpClient("/api/backend").refreshAccessToken();
  assert.equal(getAccessToken(), renewed);
});
