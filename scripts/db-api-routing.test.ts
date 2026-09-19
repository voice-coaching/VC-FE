import assert from "node:assert/strict";
import { test } from "node:test";
import { api, disableDeveloperApi } from "../src/lib/api/index";
import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "../src/lib/api/client";

test("legacy developer flag cannot substitute DB catalog, examples or errors", async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const storage = new Map<string, string>([["ttobak.developer-mode", "true"]]);
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    },
  });
  try {
    saveAccessToken("ttobak-local-development-token");
    disableDeveloperApi();
    assert.equal(getAccessToken(), null);
    saveAccessToken("real-test-session");
    storage.set("ttobak.developer-mode", "true");
    disableDeveloperApi();
    assert.equal(getAccessToken(), "real-test-session");
    storage.set("ttobak.developer-mode", "true");
    const paths: string[] = [];
    globalThis.fetch = async (input, init) => {
      paths.push(String(input));
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer real-test-session",
      );
      return Response.json({ result: true, data: { source: "database" } });
    };
    assert.deepEqual(await api.content.get(103), { source: "database" });
    assert.deepEqual(await api.examples.list(301, 303), { source: "database" });
    assert.ok(paths[0].startsWith("/api/backend/api/"));
    assert.ok(paths[1].includes("/courses/301/steps/303/practice-examples"));
    globalThis.fetch = async () =>
      Response.json(
        { result: false, message: "Unavailable", code: "UNAVAILABLE" },
        { status: 503 },
      );
    await assert.rejects(api.content.get(103), /Unavailable/);
  } finally {
    clearAccessToken();
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});
