import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createRemoteApi } from "../src/lib/api/remote";
import { ApiError } from "../src/lib/api/client";
import { titleExamErrorMessage } from "../src/lib/title-exam";

test("generic backend exam messages are distinguished by code without guessing unknown errors", () => {
  const generic = "승급 시험 요청을 처리할 수 없습니다.";
  assert.match(
    titleExamErrorMessage(
      new ApiError(generic, 503, "TITLE_EXAM_CONTENT_UNAVAILABLE"),
    ),
    /문제가 아직 준비되지/,
  );
  assert.match(
    titleExamErrorMessage(
      new ApiError(generic, 409, "TITLE_EXAM_NOT_ELIGIBLE"),
    ),
    /응시 횟수가 부족/,
  );
  assert.match(
    titleExamErrorMessage(new ApiError(generic, 409, "MAX_TITLE_REACHED")),
    /최고 칭호/,
  );
  assert.equal(
    titleExamErrorMessage(new ApiError(generic, 409, "CONFLICT")),
    generic,
  );
});
import {
  createTitleExamSession,
  prepareTitleExam,
} from "../src/lib/title-exam";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const json = (data: unknown) =>
  Response.json({ result: true, data, message: "ok" });
const api = () => createRemoteApi("/api/backend");

test("exam creation rechecks current state and resumes the server-linked session", async () => {
  const requests: string[] = [];
  globalThis.fetch = async (url, init) => {
    requests.push(`${init?.method ?? "GET"} ${url}`);
    if (init?.method === "POST") {
      assert.equal(
        new Headers(init.headers).get("Idempotency-Key"),
        "stable-key",
      );
      assert.equal(init.body, undefined);
      return json({
        id: 456,
        practiceContentId: 123,
        status: "READY",
        trainingSessionId: null,
      });
    }
    return json({
      id: 456,
      practiceContentId: 123,
      status: "IN_PROGRESS",
      trainingSessionId: 789,
    });
  };
  const target = new URL(
    await prepareTitleExam(api(), "/mypage/history", "stable-key"),
    "https://local.test",
  );
  assert.equal(target.pathname, "/practice/123");
  assert.equal(target.searchParams.get("titleExamId"), "456");
  assert.equal(target.searchParams.get("sessionId"), "789");
  assert.equal(target.searchParams.get("returnTo"), "/mypage/history");
  assert.deepEqual(requests, [
    "POST /api/backend/api/users/me/title-exams",
    "GET /api/backend/api/users/me/title-exams/456",
  ]);
});

test("exam session uses pinned content, exam ID, null course and pronunciation focus", async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/title-exams/456"))
      return json({
        id: 456,
        practiceContentId: 123,
        status: "READY",
        trainingSessionId: null,
      });
    assert.equal(String(url), "/api/backend/api/training-sessions");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      contentId: 123,
      titleExamId: 456,
      courseStepId: null,
      learningFocus: "PRONUNCIATION",
    });
    return json({ sessionId: 789 });
  };
  assert.equal(await createTitleExamSession(api(), "456", "123"), 789);
});

test("existing exam session is reused without a second creation", async () => {
  globalThis.fetch = async (_url, init) => {
    assert.notEqual(init?.method, "POST");
    return json({
      id: 456,
      practiceContentId: 123,
      status: "IN_PROGRESS",
      trainingSessionId: 789,
    });
  };
  assert.equal(await createTitleExamSession(api(), 456, 123), 789);
});

test("mismatched content and graded exams cannot create recording sessions", async () => {
  for (const [contentId, status] of [
    [999, "READY"],
    [123, "PASSED"],
    [123, "FAILED"],
  ] as const) {
    globalThis.fetch = async (_url, init) => {
      assert.notEqual(init?.method, "POST");
      return json({
        id: 456,
        practiceContentId: contentId,
        status,
        trainingSessionId: null,
      });
    };
    await assert.rejects(createTitleExamSession(api(), 456, 123));
  }
});

test("grading sends only the server analysis ID, never a client score", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(
      String(url),
      "/api/backend/api/users/me/title-exams/456/submit",
    );
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { analysisId: 789 });
    return json({ examId: 456, passed: true, status: "PASSED", score: 80 });
  };
  assert.equal((await api().users.submitTitleExam(456, 789)).passed, true);
});

test("all example difficulties use the existing content API and pronunciation filter", async () => {
  for (const difficulty of ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const) {
    globalThis.fetch = async (url) => {
      const parsed = new URL(String(url), "https://local.test");
      assert.equal(parsed.pathname, "/api/backend/api/practice-contents");
      assert.deepEqual(Object.fromEntries(parsed.searchParams), {
        type: "SENTENCE",
        category: "EXAMPLE_QUESTION",
        difficulty,
        focus: "PRONUNCIATION",
        page: "0",
        size: "10",
      });
      return json({
        items: [{ id: 123 }],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
      });
    };
    assert.equal(
      (
        await api().content.list({
          type: "SENTENCE",
          category: "EXAMPLE_QUESTION",
          difficulty,
          focus: "PRONUNCIATION",
          page: 0,
          size: 10,
        })
      ).items[0].id,
      123,
    );
  }
});
