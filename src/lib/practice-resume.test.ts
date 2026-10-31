import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createRemoteApi } from "./api/remote";
import { ApiError } from "./api/client";
import type { TrainingSession, VoiceRecording } from "./api/types";
import { loadPracticeResume } from "./practice-resume";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const json = (data: unknown) => Response.json({ result: true, data });
const recording: VoiceRecording = {
  id: 55,
  selected: true,
  attemptNo: 1,
  qualityStatus: "PASS",
  analysisMediaType: "AUDIO_ONLY",
};

function server(
  status: TrainingSession["status"],
  attempts: VoiceRecording[] = [],
  analysisAvailable = false,
) {
  const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(
      init?.method ?? "GET",
      "GET",
      "resuming must never submit an analysis or cancel a session",
    );
    const path = String(url);
    calls.push(path);
    if (path.endsWith("/recordings")) return json({ items: attempts });
    assert.equal(path, "/api/backend/api/training-sessions/77");
    return json({
      id: 77,
      status,
      content: { id: 123 },
      selectedRecordingId: attempts.find((item) => item.selected)?.id ?? null,
      analysisAvailable,
    });
  };
  return { api: createRemoteApi("/api/backend"), calls };
}

for (const status of ["RECORDING", "UPLOADING"] as const) {
  test(`linked ${status} exam without a recording opens recording preparation`, async () => {
    const s = server(status);
    const state = await loadPracticeResume(s.api, 77, 123, true);
    assert.equal(state.phase, "idle");
    assert.equal(state.sessionId, 77);
    assert.equal(state.selectedRecordingId, null);
    assert.equal(s.calls.length, 2);
  });
}

test("an uploaded recording without submitted analysis does not enter polling", async () => {
  const { api } = server("UPLOADING", [recording]);
  const state = await loadPracticeResume(api, 77, 123, true);
  assert.equal(state.phase, "idle");
  assert.equal(state.selectedRecordingId, 55);
  assert.deepEqual(state.attempts, [recording]);
});

for (const status of ["ANALYZING", "COMPLETED"] as const) {
  test(`${status} exam with a selected recording preserves its existing analysis`, async () => {
    const { api } = server(status, [recording], status === "COMPLETED");
    const state = await loadPracticeResume(api, 77, 123, true);
    assert.equal(state.phase, "analyzing");
    assert.equal(state.sessionId, 77);
    assert.equal(state.selectedRecordingId, 55);
    assert.equal(state.completed, status === "COMPLETED");
  });
}

for (const status of ["CANCELED", "FAILED"] as const) {
  test(`${status} exam session is detached so the backend can rebind a new recording`, async () => {
    const { api } = server(status, [recording]);
    const state = await loadPracticeResume(api, 77, 123, true);
    assert.equal(state.phase, "idle");
    assert.equal(state.sessionId, null);
    assert.equal(state.selectedRecordingId, null);
    assert.deepEqual(state.attempts, []);
  });
}

test("regular failed analysis retains its recovery path", async () => {
  const { api } = server("FAILED", [recording]);
  assert.equal((await loadPracticeResume(api, 77, 123)).phase, "analyzing");
});

test("server-confirmed analysis is restored even if session status is lagging", async () => {
  const { api } = server("RECORDING", [recording], true);
  assert.equal(
    (await loadPracticeResume(api, 77, 123, true)).phase,
    "analyzing",
  );
});

test("missing analysis recording and mismatched content cannot start a new recording", async () => {
  const { api } = server("ANALYZING");
  await assert.rejects(
    loadPracticeResume(api, 77, 123, true),
    (reason: unknown) =>
      reason instanceof ApiError &&
      reason.code === "ANALYSIS_RECORDING_MISSING",
  );
  await assert.rejects(
    loadPracticeResume(api, 77, 999, true),
    /콘텐츠가 일치하지/,
  );
});

test("a failed session read remains an error and can be retried before recording", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("offline");
  };
  const api = createRemoteApi("/api/backend");
  await assert.rejects(
    loadPracticeResume(api, 77, 123, true),
    (reason: unknown) =>
      reason instanceof ApiError && reason.code === "NETWORK_ERROR",
  );
  server("RECORDING");
  assert.equal((await loadPracticeResume(api, 77, 123, true)).phase, "idle");
});
