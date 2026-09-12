import assert from "node:assert/strict";
import test from "node:test";
import {
  addCompletion,
  parseHistory,
  todaySummary,
  type PracticeCompletion,
} from "./prototype-history";
const item: PracticeCompletion = {
  id: "one",
  mode: "news",
  title: "뉴스",
  sentenceCount: 3,
  completedAt: new Date(2026, 8, 11, 12).toISOString(),
  daily: true,
};
test("completion is idempotent and capped at 100 records", () => {
  assert.equal(addCompletion([item], item).length, 1);
  const items = Array.from({ length: 100 }, (_, index) => ({
    ...item,
    id: String(index),
  }));
  assert.equal(addCompletion(items, item).length, 100);
  assert.equal(addCompletion(items, item)[0].id, "one");
});
test("today uses the local calendar and daily completion is explicit", () => {
  assert.deepEqual(todaySummary([item], new Date(2026, 8, 11, 23)), {
    count: 1,
    sentences: 3,
    dailyDone: true,
  });
  assert.deepEqual(todaySummary([item], new Date(2026, 8, 12, 0)), {
    count: 0,
    sentences: 0,
    dailyDone: false,
  });
  assert.equal(
    todaySummary([{ ...item, daily: false }], new Date(2026, 8, 11)).dailyDone,
    false,
  );
});
test("bad storage and unsupported records are ignored", () => {
  assert.deepEqual(parseHistory("broken"), []);
  assert.deepEqual(
    parseHistory(
      JSON.stringify([
        null,
        { ...item, mode: "toString" },
        { ...item, sentenceCount: -1 },
        { ...item, completedAt: "invalid" },
        item,
      ]),
    ),
    [item],
  );
});
