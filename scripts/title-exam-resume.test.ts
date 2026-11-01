import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createRemoteApi } from "../src/lib/api/remote";
import { ApiError } from "../src/lib/api/client";
import { loadTitleExamResume } from "../src/lib/title-exam-resume";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const json = (data: unknown) => Response.json({ result: true, data });

function server(
  options: {
    linked?: number | null;
    replaceWith?: number;
    selected?: number;
    status?: string;
    graded?: boolean;
    wrongContent?: boolean;
    offline?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const linked = options.linked === undefined ? 138 : options.linked;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${path}`);
    if (path.endsWith("/title-exams/2"))
      return json({
        id: 2,
        practiceContentId: options.wrongContent ? 999 : 183,
        trainingSessionId: linked,
        status: options.graded ? "PASSED" : "IN_PROGRESS",
      });
    if (method === "POST") {
      assert.equal(
        path,
        "/api/backend/api/training-sessions",
        "recovery must never cancel or resubmit an analysis",
      );
      assert.deepEqual(JSON.parse(String(init?.body)), {
        contentId: 183,
        titleExamId: 2,
        courseStepId: null,
        learningFocus: "PRONUNCIATION",
      });
      return json({
        sessionId: options.replaceWith ?? linked ?? 139,
        status: "RECORDING",
      });
    }
    if (options.offline) throw new TypeError("offline");
    const id = Number(path.match(/training-sessions\/(\d+)/)?.[1]);
    assert.ok(id === linked || id === options.replaceWith || id === 139);
    const replacement = id !== linked;
    if (path.endsWith("/recordings"))
      return json({
        items:
          !replacement && options.selected
            ? [
                {
                  id: options.selected,
                  selected: true,
                  qualityStatus: "PASS",
                  attemptNo: 1,
                },
              ]
            : [],
      });
    return json({
      id,
      status: replacement ? "RECORDING" : (options.status ?? "ANALYZING"),
      content: { id: 183 },
      selectedRecordingId: !replacement ? (options.selected ?? null) : null,
      analysisAvailable: false,
    });
  };
  return { api: createRemoteApi("/api/backend"), calls };
}

test("an unusable linked title exam is rebound by the server and opens recording preparation", async () => {
  const s = server({ replaceWith: 139 });
  const state = await loadTitleExamResume(s.api, 2, 183);
  assert.equal(state.phase, "idle");
  assert.equal(state.sessionId, 139);
  assert.equal(state.selectedRecordingId, null);
  assert.equal(s.calls.filter((call) => call.startsWith("POST")).length, 1);
  assert.ok(s.calls.some((call) => call.endsWith("/training-sessions/139")));
});

test("a stale session URL cannot override the exam's current valid analysis link", async () => {
  const s = server({ linked: 150, selected: 108 });
  const state = await loadTitleExamResume(s.api, 2, 183);
  assert.equal(state.phase, "analyzing");
  assert.equal(state.sessionId, 150);
  assert.equal(state.selectedRecordingId, 108);
  assert.equal(
    s.calls.some((call) => call.includes("/138")),
    false,
  );
  assert.equal(
    s.calls.some((call) => call.startsWith("POST")),
    false,
  );
});

test("a server that retains the unusable session cannot cause an automatic repair loop", async () => {
  const s = server();
  await assert.rejects(
    loadTitleExamResume(s.api, 2, 183),
    (error: unknown) =>
      error instanceof ApiError && error.code === "ANALYSIS_RECORDING_MISSING",
  );
  assert.equal(s.calls.filter((call) => call.startsWith("POST")).length, 1);
});

test("network failures do not authorize replacing the existing exam session", async () => {
  const s = server({ offline: true });
  await assert.rejects(
    loadTitleExamResume(s.api, 2, 183),
    (error: unknown) =>
      error instanceof ApiError && error.code === "NETWORK_ERROR",
  );
  assert.equal(
    s.calls.some((call) => call.startsWith("POST")),
    false,
  );
});

test("already graded exams and different content cannot create a new attempt", async () => {
  const graded = server({ graded: true });
  await assert.rejects(
    loadTitleExamResume(graded.api, 2, 183),
    /이미 채점된 시험/,
  );
  assert.equal(
    graded.calls.some((call) => call.startsWith("POST")),
    false,
  );
  const wrong = server({ wrongContent: true });
  await assert.rejects(
    loadTitleExamResume(wrong.api, 2, 183),
    /콘텐츠가 일치하지/,
  );
  assert.equal(wrong.calls.length, 1);
});

test("an unbound exam obtains its server-created session before restoring it", async () => {
  const s = server({ linked: null, replaceWith: 139 });
  const state = await loadTitleExamResume(s.api, 2, 183);
  assert.equal(state.phase, "idle");
  assert.equal(state.sessionId, 139);
  assert.equal(s.calls.filter((call) => call.startsWith("POST")).length, 1);
});

test("leaving the exam during restore cannot start a session repair", async () => {
  const s = server({ replaceWith: 139 });
  let checks = 0;
  await assert.rejects(
    loadTitleExamResume(s.api, 2, 183, () => ++checks === 1),
    (error: unknown) =>
      error instanceof ApiError && error.code === "REQUEST_ABORTED",
  );
  assert.equal(
    s.calls.some((call) => call.startsWith("POST")),
    false,
  );
});
