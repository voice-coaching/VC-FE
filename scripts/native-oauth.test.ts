import assert from "node:assert/strict";
import test from "node:test";
import {
  readOAuthAttempt,
  takeOAuthAttempt,
  OAUTH_ATTEMPT_TTL_MS,
} from "../src/lib/oauth-attempt";
import {
  createNativeOAuthCallbackUrlFromResponse,
  parseNativeOAuthCallback,
} from "../src/lib/native-oauth-callback";

function storedAttempt(createdAt = Date.now()) {
  const values = new Map([
    [
      "attempt",
      JSON.stringify({
        state: "native.current",
        native: true,
        createdAt,
        redirectUri: "https://example.com/oauth/google/callback",
        returnTo: "/home",
      }),
    ],
  ]);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

test("a stale iOS callback cannot destroy a newer login", () => {
  const storage = storedAttempt();
  assert.equal(takeOAuthAttempt(storage, "attempt", "native.old"), null);
  assert.equal(
    readOAuthAttempt(storage, "attempt", "native.current")?.state,
    "native.current",
  );
  assert.ok(takeOAuthAttempt(storage, "attempt", "native.current"));
  assert.equal(takeOAuthAttempt(storage, "attempt", "native.current"), null);
});

test("expired callbacks cannot be exchanged", () => {
  const storage = storedAttempt(Date.now() - OAUTH_ATTEMPT_TTL_MS - 1);
  assert.equal(readOAuthAttempt(storage, "attempt", "native.current"), null);
});

test("all providers preserve the authorization code and state through the app link", () => {
  for (const provider of ["GOOGLE", "KAKAO", "NAVER"] as const) {
    const response = { code: "code+with/slash=&?", state: "native.current" };
    const callback = parseNativeOAuthCallback(
      createNativeOAuthCallbackUrlFromResponse(provider, response),
    );
    assert.equal(callback?.provider, provider);
    assert.equal(callback?.searchParams.get("code"), response.code);
    assert.equal(callback?.searchParams.get("state"), response.state);
  }
});

test("invalid and unrelated links are ignored", () => {
  assert.equal(parseNativeOAuthCallback("invalid"), null);
  assert.equal(
    parseNativeOAuthCallback("https://example.com/google/callback"),
    null,
  );
  assert.equal(parseNativeOAuthCallback("speakai://oauth/unrelated"), null);
});
