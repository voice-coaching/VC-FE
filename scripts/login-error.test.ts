import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../src/lib/api/client";
import { loginErrorMessage } from "../src/lib/login-error";

test("only an authentication rejection is described as invalid credentials", () => {
  assert.match(
    loginErrorMessage(new ApiError("Unauthorized", 401)),
    /이메일 또는 비밀번호/,
  );
});

test("network and server failures do not blame the password", () => {
  for (const reason of [
    new TypeError("Failed to fetch"),
    new ApiError("Unavailable", 503),
    null,
  ]) {
    assert.match(loginErrorMessage(reason), /다시 시도/);
    assert.doesNotMatch(loginErrorMessage(reason), /비밀번호/);
  }
});

test("rate limiting explains when to retry", () => {
  assert.match(loginErrorMessage(new ApiError("Rate limited", 429)), /잠시 후/);
});
