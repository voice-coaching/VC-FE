import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./api/client";
import {
  classExamplesErrorMessage,
  classPracticeHref,
  orderedCourseExamples,
} from "./class-practice";
import type { PracticeExamples } from "./api/types";

const examples: PracticeExamples = {
  courseId: 60,
  stepId: 12,
  revision: 4,
  items: [
    {
      id: "second",
      order: 2,
      text: "둘째 문장",
      hint: null,
      focus: "PRONUNCIATION",
      locale: "ko-KR",
      practiceContentId: 102,
    },
    {
      id: "first",
      order: 1,
      text: "첫 문장",
      hint: null,
      focus: "PRONUNCIATION",
      locale: "ko-KR",
      practiceContentId: 101,
    },
  ],
};

test("sorts class sentences and routes with the backend-selected step", () => {
  const ordered = orderedCourseExamples(examples, 60);
  assert.deepEqual(
    ordered.items.map((item) => item.id),
    ["first", "second"],
  );
  const href = classPracticeHref(ordered, 1, "/class?course=60");
  assert.match(href, /^\/practice\/102\?/);
  const params = new URL(href, "https://example.test").searchParams;
  assert.equal(params.get("courseId"), "60");
  assert.equal(params.get("courseStepId"), "12");
  assert.equal(params.get("exampleId"), "second");
  assert.equal(params.get("exampleRevision"), "4");
});

test("never fabricates a sentence when the class response is empty", () => {
  assert.throws(
    () => orderedCourseExamples({ ...examples, items: [] }, 60),
    (reason: unknown) =>
      reason instanceof ApiError &&
      reason.code === "PRACTICE_EXAMPLES_UNAVAILABLE",
  );
});

test("gives actionable class entry errors", () => {
  assert.match(
    classExamplesErrorMessage(new ApiError("raw", 404, "NOT_FOUND")),
    /접근할 수 없는 클래스/,
  );
  assert.match(
    classExamplesErrorMessage(
      new ApiError("raw", 503, "PRACTICE_EXAMPLES_UNAVAILABLE"),
    ),
    /준비되지 않았습니다/,
  );
});
