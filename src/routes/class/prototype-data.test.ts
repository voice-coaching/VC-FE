import assert from "node:assert/strict";
import test from "node:test";
import {
  completedAfterStep,
  parseClassProgress,
  pronunciationCourses,
  intonationCourses,
} from "./prototype-data";

test("Figma prototype starts at 0/8, 6/6, 4/12 and 0/10", () => {
  assert.deepEqual(parseClassProgress(null), [0, 6, 4, 0]);
  assert.deepEqual(
    pronunciationCourses.map((course) => course.steps.length),
    [8, 6, 12, 10],
  );
});

test("intonation progress is validated against its own curriculum", () => {
  assert.deepEqual(parseClassProgress(null, intonationCourses), [0, 6, 0]);
  assert.deepEqual(parseClassProgress("[6,3,8]", intonationCourses), [6, 3, 8]);
  assert.deepEqual(
    parseClassProgress("[7,-1,9]", intonationCourses),
    [0, 6, 0],
  );
  assert.deepEqual(parseClassProgress("broken", intonationCourses), [0, 6, 0]);
  assert.equal(completedAfterStep(5, 5, 6), 6);
  assert.equal(completedAfterStep(6, 0, 6), 6);
});
test("completed steps unlock the next step without losing review progress", () => {
  assert.equal(completedAfterStep(4, 4, 12), 5);
  assert.equal(completedAfterStep(8, 2, 12), 8);
  assert.equal(completedAfterStep(11, 11, 12), 12);
});
test("progress storage handles corruption and out-of-range values", () => {
  assert.deepEqual(parseClassProgress("broken"), [0, 6, 4, 0]);
  assert.deepEqual(parseClassProgress('{"final":8}'), [0, 6, 4, 0]);
  assert.deepEqual(parseClassProgress("[8,0,12,10]"), [8, 0, 12, 10]);
  assert.deepEqual(parseClassProgress('[-1,7,4.5,"3"]'), [0, 6, 4, 0]);
});
