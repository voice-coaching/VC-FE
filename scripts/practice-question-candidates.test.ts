import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const data = JSON.parse(
  readFileSync(
    new URL(
      "../docs/migration/practice-question-candidates.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("nine candidate sets each contain five unique Korean exercises", () => {
  assert.equal(data.status, "DRAFT_NOT_PUBLISHED");
  assert.equal(data.sets.length, 9);
  const texts = new Set<string>();
  const keys = new Set<string>();
  for (const set of data.sets) {
    assert.ok(!keys.has(set.sourceKey));
    keys.add(set.sourceKey);
    assert.equal(set.examples.length, 5);
    assert.ok(
      ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(set.difficulty),
    );
    set.examples.forEach(
      (
        example: { order: number; text: string; title: string; hint: string },
        index: number,
      ) => {
        assert.equal(example.order, index + 1);
        assert.ok(example.title && example.hint);
        assert.match(example.text, /[가-힣]/);
        assert.ok(!texts.has(example.text));
        texts.add(example.text);
        assert.ok(
          !("practiceContentId" in example),
          "drafts must not invent server IDs",
        );
      },
    );
  }
  assert.equal(texts.size, 45);
});

test("pronunciation and intonation each cover all three difficulties", () => {
  for (const type of ["PRONUNCIATION", "INTONATION"]) {
    const sets = data.sets.filter(
      (set: { courseType?: string }) => set.courseType === type,
    );
    assert.deepEqual(
      sets.map((set: { difficulty: string }) => set.difficulty).sort(),
      ["ADVANCED", "BEGINNER", "INTERMEDIATE"],
    );
    for (const set of sets) {
      assert.equal(set.contentType, "CLASS_PRACTICE");
      assert.equal(set.learningFocus, type);
    }
  }
});

test("fictional news cannot be mistaken for sourced reporting", () => {
  const news = data.sets.find(
    (set: { contentType: string }) => set.contentType === "NEWS",
  );
  assert.equal(news.fictional, true);
  for (const example of news.examples) {
    assert.match(example.title, /^\[창작 연습용\]/);
    assert.match(example.text, /가상의/);
    assert.ok(
      ["ECONOMY", "SOCIETY", "CULTURE", "SPORTS"].includes(example.category),
    );
  }
});
