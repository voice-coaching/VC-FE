import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  ApiError,
  clearAccessToken,
  createHttpClient,
} from "../src/lib/api/client";
import { captureApiErrorDiagnostics } from "../src/lib/api/error-diagnostics";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});

test("a rejected recording selection retains the server envelope and failing endpoint", async () => {
  const response = {
    result: false,
    message: "잘못된 입력값입니다.",
    code: "INVALID_INPUT_VALUE",
    data: { reason: "recording selection rejected" },
  };
  globalThis.fetch = async () => Response.json(response, { status: 400 });
  await assert.rejects(
    createHttpClient("/api/backend").request(
      "/api/training-sessions/138/recordings/108/select",
      { method: "PATCH" },
    ),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "INVALID_INPUT_VALUE");
      assert.deepEqual(error.details, response.data);
      assert.deepEqual(error.diagnostics, {
        request: {
          method: "PATCH",
          path: "/api/backend/api/training-sessions/138/recordings/108/select",
        },
        response,
      });
      return true;
    },
  );
});

test("a backend error without code is shown intact instead of inventing a server code", async () => {
  const response = { result: false, message: "요청 거절", data: null };
  globalThis.fetch = async () => Response.json(response, { status: 409 });
  await assert.rejects(
    createHttpClient("/api/backend").request(
      "/api/training-sessions/138/analyze",
      {
        method: "POST",
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "API_ERROR");
      assert.deepEqual(error.diagnostics?.response, response);
      return true;
    },
  );
});

test("non-JSON and malformed JSON proxy errors remain available for diagnosis", async () => {
  for (const contentType of ["text/plain", "application/json"]) {
    globalThis.fetch = async () =>
      new Response("upstream unavailable", {
        status: 503,
        headers: { "Content-Type": contentType },
      });
    await assert.rejects(
      createHttpClient("/api/backend").request(
        "/api/training-sessions/138/analyze",
        {
          method: "POST",
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 503);
        assert.equal(error.diagnostics?.response, "upstream unavailable");
        return true;
      },
    );
  }
});

test("auth refresh failures preserve the refresh endpoint's actual response", async () => {
  const response = {
    result: false,
    code: "REFRESH_EXPIRED",
    message: "expired",
  };
  globalThis.fetch = async () => Response.json(response, { status: 401 });
  await assert.rejects(
    createHttpClient("/api/backend").request(
      "/api/training-sessions/138/analyze",
      {
        method: "POST",
        endpointErrorsOnly: true,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "AUTH_REFRESH_FAILED");
      assert.equal(
        error.diagnostics?.request.path,
        "/api/backend/api/auth/token/refresh",
      );
      assert.deepEqual(error.diagnostics?.response, response);
      return true;
    },
  );
});

test("diagnostics exclude signed URL credentials and nested tokens", () => {
  const diagnostic = captureApiErrorDiagnostics(
    "put",
    "https://storage.example/recordings/108.wav?X-Amz-Signature=sensitive#fragment",
    {
      code: "FORBIDDEN",
      data: {
        accessToken: "access-secret",
        nested: [{ refresh_token: "refresh-secret" }],
        uploadUrl: "signed-secret",
        message:
          "Bearer bearer-secret https://storage.example/file?signature=url-secret",
      },
    },
  );
  assert.equal(diagnostic.request.path, "/recordings/108.wav");
  const text = JSON.stringify(diagnostic);
  for (const secret of [
    "sensitive",
    "access-secret",
    "refresh-secret",
    "signed-secret",
    "bearer-secret",
    "url-secret",
  ])
    assert.ok(!text.includes(secret));
  assert.ok(text.includes("FORBIDDEN"));
});
