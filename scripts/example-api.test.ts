import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  ApiError,
  clearAccessToken,
  createHttpClient,
  saveAccessToken,
} from "../src/lib/api/client";
import { createRemoteApi } from "../src/lib/api/remote";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});
const json = (data: unknown, status = 200, code?: string) =>
  Response.json(
    { result: status < 400, data, message: "test", code },
    { status },
  );
const mp3 = () =>
  new Response(new Uint8Array([73, 68, 51, 1]), {
    headers: { "content-type": "audio/mpeg" },
  });

test("DB examples use the course/step API with pinned session", async () => {
  globalThis.fetch = async (url) => {
    assert.equal(
      String(url),
      "/api/backend/api/courses/12/steps/34/practice-examples?sessionId=56",
    );
    return json({ courseId: 12, stepId: 34, revision: 7, items: [] });
  };
  assert.equal(
    (await createRemoteApi("/api/backend").examples.list(12, 34, 56)).revision,
    7,
  );
});
test("MP3 requests share token refresh with JSON requests", async () => {
  saveAccessToken("expired");
  let refreshes = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/token/refresh")) {
      refreshes++;
      return json({
        accessToken: "renewed",
        tokenType: "Bearer",
        expiresIn: 600,
      });
    }
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") === "Bearer expired")
      return json(null, 401);
    assert.equal(headers.get("Authorization"), "Bearer renewed");
    assert.equal(headers.get("Accept"), "audio/mpeg");
    return mp3();
  };
  const api = createRemoteApi("/api/backend");
  const blobs = await Promise.all([
    api.examples.getAudio("db-1"),
    api.examples.getAudio("db-2"),
  ]);
  assert.equal(refreshes, 1);
  assert.deepEqual(
    blobs.map((b) => b.size),
    [4, 4],
  );
});
for (const [name, response] of [
  ["JSON success", () => json({ audioUrl: "wrong" })],
  [
    "empty MP3",
    () => new Response("", { headers: { "content-type": "audio/mpeg" } }),
  ],
  [
    "oversized MP3",
    () =>
      new Response(new Uint8Array(2_000_001), {
        headers: { "content-type": "audio/mpeg" },
      }),
  ],
  ["204", () => new Response(null, { status: 204 })],
] as const)
  test(`rejects ${name} as audio`, async () => {
    globalThis.fetch = async () => response();
    await assert.rejects(
      createHttpClient("").requestAudio("/audio"),
      (e: unknown) => e instanceof ApiError && e.code === "INVALID_AUDIO",
    );
  });
test("JSON errors preserve TTS failure codes instead of returning a Blob", async () => {
  globalThis.fetch = async () => json(null, 503, "TTS_UNAVAILABLE");
  await assert.rejects(
    createHttpClient("").requestAudio("/audio"),
    (e: unknown) => e instanceof ApiError && e.code === "TTS_UNAVAILABLE",
  );
});
test("304 is not played as an empty audio file", async () => {
  globalThis.fetch = async () => new Response(null, { status: 304 });
  await assert.rejects(
    createHttpClient("").requestAudio("/audio"),
    (e: unknown) => e instanceof ApiError && e.status === 304,
  );
});
test("selection cancellation reaches fetch", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    });
  const pending = createHttpClient("").requestAudio("/audio", {
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(
    pending,
    (e: unknown) => e instanceof ApiError && e.code === "REQUEST_ABORTED",
  );
});
test("logout during an audio response prevents stale audio delivery", async () => {
  saveAccessToken("session");
  globalThis.fetch = async () => {
    clearAccessToken();
    return mp3();
  };
  await assert.rejects(
    createHttpClient("").requestAudio("/audio"),
    (e: unknown) => e instanceof ApiError && e.code === "AUTH_SESSION_CHANGED",
  );
});
test("custom sentences are persisted using a stable idempotency key", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "/api/backend/api/practice-contents/custom");
    assert.equal(init?.method, "POST");
    assert.equal(
      new Headers(init?.headers).get("Idempotency-Key"),
      "request-1",
    );
    assert.equal(JSON.parse(String(init?.body)).retention, "SESSION_HISTORY");
    return json({ id: 222 }, 201);
  };
  assert.equal(
    (
      await createRemoteApi("/api/backend").content.createCustom(
        {
          title: "내 문장",
          scriptText: "서버 문장",
          learningFocus: "PRONUNCIATION",
          retention: "SESSION_HISTORY",
          locale: "ko-KR",
        },
        "request-1",
      )
    ).id,
    222,
  );
});

test("legacy TTS URL forwards DB ID, auth, and MP3 without local synthesis", async () => {
  const previous = process.env.API_BASE_URL;
  process.env.API_BASE_URL = "https://backend.example.test";
  try {
    const { GET } = await import("../src/app/api/tts/route");
    globalThis.fetch = async (url, init) => {
      assert.equal(
        String(url),
        "https://backend.example.test/api/practice-examples/db-1/audio",
      );
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer user-token",
      );
      return mp3();
    };
    const response = await GET(
      new Request("https://frontend.example.test/api/tts?exampleId=db-1", {
        headers: { Authorization: "Bearer user-token" },
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal((await response.blob()).size, 4);
    globalThis.fetch = async () => {
      throw new Error("invalid ID must not reach upstream");
    };
    assert.equal(
      (
        await GET(
          new Request(
            "https://frontend.example.test/api/tts?exampleId=..%2Ffoo",
          ),
        )
      ).status,
      400,
    );
  } finally {
    if (previous === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previous;
  }
});
