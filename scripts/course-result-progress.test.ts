import assert from "node:assert/strict";
import test from "node:test";
import { courseResultProgress } from "../src/lib/course-result-progress";
import type { CourseProgress, CourseStep } from "../src/lib/api";

const steps: CourseStep[] = [
  { id: 1, stepOrder: 1, stepType: "THEORY", title: "원리", completed: false },
  {
    id: 2,
    stepOrder: 2,
    stepType: "AUDIO_EXAMPLE",
    title: "예시",
    completed: false,
  },
  {
    id: 3,
    stepOrder: 3,
    stepType: "PRACTICE",
    title: "녹음",
    completed: false,
  },
  {
    id: 4,
    stepOrder: 4,
    stepType: "RESULT_REVIEW",
    title: "결과",
    completed: false,
  },
];
const current: CourseProgress = {
  courseId: 1,
  status: "IN_PROGRESS",
  lastStepId: 2,
  progressPercent: 50,
};
test("last practice and its result review finish the course even when steps arrive unsorted", () => {
  assert.deepEqual(courseResultProgress([...steps].reverse(), current, "3"), {
    lastStepId: 4,
    progressPercent: 100,
  });
});
test("a following lesson is not silently completed", () => {
  assert.deepEqual(
    courseResultProgress(
      [...steps, { ...steps[0], id: 5, stepOrder: 5 }],
      current,
      3,
    ),
    { lastStepId: 4, progressPercent: 80 },
  );
});
test("replaying an earlier exercise preserves saved progress", () => {
  assert.deepEqual(
    courseResultProgress(
      [...steps, { ...steps[0], id: 5, stepOrder: 5 }],
      { ...current, lastStepId: 5, progressPercent: 100 },
      3,
    ),
    { lastStepId: 5, progressPercent: 100 },
  );
});
test("unknown practice IDs cannot advance a course", () => {
  assert.throws(() => courseResultProgress(steps, current, 99));
});
