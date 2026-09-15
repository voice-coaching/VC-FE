import assert from "node:assert/strict";
import test from "node:test";
import {
  findPracticeExample,
  getPracticeExampleSet,
  practiceExampleSets,
} from "./practice-examples";

test("every pronunciation and intonation issue has five unique examples", () => {
  const allIds = Object.values(practiceExampleSets).flatMap((set) =>
    set.examples.map((example) => example.id),
  );

  for (const set of Object.values(practiceExampleSets)) {
    assert.equal(set.examples.length, 5);
    assert.equal(new Set(set.examples.map((example) => example.text)).size, 5);
  }
  assert.equal(allIds.length, 35);
  assert.equal(new Set(allIds).size, 35);
});

test("course and step names resolve to the intended issue", () => {
  assert.equal(
    getPracticeExampleSet({
      courseType: "PRONUNCIATION",
      courseTitle: "받침 발음 기초 클래스",
      stepTitle: "받침 ㄹ 소리 내기",
    }).category,
    "final-consonant",
  );
  assert.equal(
    getPracticeExampleSet({
      courseType: "INTONATION",
      courseTitle: "전달력을 높이는 억양 클래스",
      stepTitle: "강조 억양 듣기",
    }).category,
    "word-stress",
  );
  assert.equal(
    findPracticeExample("word-stress-3")?.text.includes("안전"),
    true,
  );
  assert.equal(findPracticeExample("not-registered"), undefined);
});
