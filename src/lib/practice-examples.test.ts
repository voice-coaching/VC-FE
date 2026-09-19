import assert from "node:assert/strict";
import test from "node:test";
import { loadPracticeContent } from "./practice-examples";
import { createRemoteApi } from "./api/remote";
import { ApiError } from "./api/client";
import type { PracticeContent, PracticeExamples } from "./api/types";

const content: PracticeContent = {
  id: 222,
  contentType: "CLASS_PRACTICE",
  title: "DB",
  scriptText: "서버 문장",
  category: "자음",
  difficulty: "BEGINNER",
  learningFocus: "PRONUNCIATION",
  description: "",
  estimatedSeconds: 10,
  targetPronunciations: [],
  referenceAudioAvailable: false,
};
const set: PracticeExamples = {
  courseId: 1,
  stepId: 2,
  revision: 3,
  items: [
    {
      id: "db-example",
      order: 1,
      text: content.scriptText,
      hint: null,
      focus: "PRONUNCIATION",
      locale: "ko-KR",
      practiceContentId: 222,
    },
  ],
};
const selection = {
  exampleId: "db-example",
  courseId: "1",
  stepId: "2",
  revision: "3",
  sessionId: "99",
};
function fixture(value = set, detail = content) {
  const api = createRemoteApi("/api/backend");
  const calls: unknown[][] = [];
  api.examples.list = async (...args) => {
    calls.push(args);
    return value;
  };
  api.content.get = async (...args) => {
    calls.push(args);
    return detail;
  };
  return { api, calls };
}
test("uses DB content and session-pinned revision instead of the course default", async () => {
  const { api, calls } = fixture();
  assert.equal(await loadPracticeContent(api, "222", selection), content);
  assert.deepEqual(calls, [["1", "2", "99"], [222]]);
});
for (const [label, overrides, contentId] of [
  ["legacy static ID", { exampleId: "consonant-1" }, "222"],
  ["different revision", { revision: "2" }, "222"],
  ["missing course context", { courseId: null }, "222"],
  ["wrong content ID", {}, "101"],
] as const) {
  test(`rejects ${label} without fabricated content`, async () => {
    const { api, calls } = fixture();
    await assert.rejects(
      loadPracticeContent(api, contentId, { ...selection, ...overrides }),
      (e: unknown) => e instanceof ApiError && e.code === "EXAMPLE_CHANGED",
    );
    assert.ok(calls.every((call) => call.length === 3));
  });
}
test("rejects a transcript different from the displayed example", async () => {
  const { api } = fixture(set, { ...content, scriptText: "다른 문장" });
  await assert.rejects(loadPracticeContent(api, 222, selection), /예문 정보/);
});
test("normal practice uses the content API directly", async () => {
  const { api, calls } = fixture();
  await loadPracticeContent(api, 222, { ...selection, exampleId: null });
  assert.deepEqual(calls, [[222]]);
});
test("unavailable examples propagate the backend error", async () => {
  const { api } = fixture();
  api.examples.list = async () => {
    throw new ApiError("미등록", 503, "PRACTICE_EXAMPLES_UNAVAILABLE");
  };
  await assert.rejects(loadPracticeContent(api, 222, selection), /미등록/);
});
