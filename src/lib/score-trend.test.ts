import assert from "node:assert/strict";
import test from "node:test";
import { groupScoreTrend } from "./score-trend";

test("weights daily scores by session count and preserves missing weeks", () => {
  const result = groupScoreTrend(
    [
      { date: "2026-09-14T12:00:00", score: 40, sessionCount: 1 },
      { date: "2026-09-15T12:00:00", score: 80, sessionCount: 3 },
      { date: "2026-09-01T12:00:00", score: 0, sessionCount: 1 },
    ],
    "week",
    new Date("2026-09-16T12:00:00"),
  );
  assert.equal(result.length, 8);
  assert.equal(result.at(-1)?.score, 70);
  assert.equal(result.at(-1)?.count, 4);
  assert.equal(result.at(-2)?.score, null);
  assert.equal(result.at(-3)?.score, 0);
});

test("month buckets cross year boundaries and omit invalid or future points", () => {
  const result = groupScoreTrend(
    [
      { date: "2025-12-31T12:00:00", score: 60, sessionCount: 1 },
      { date: "2026-01-01T12:00:00", score: 80, sessionCount: 1 },
      { date: "2026-03-01T12:00:00", score: 100, sessionCount: 1 },
      { date: "invalid", score: 99, sessionCount: 1 },
      { date: "2026-01-02T12:00:00", score: Number.NaN, sessionCount: 1 },
    ],
    "month",
    new Date("2026-01-15T12:00:00"),
  );
  assert.equal(result.length, 6);
  assert.equal(result[0].key, "2025-08-01");
  assert.equal(result.at(-2)?.score, 60);
  assert.equal(result.at(-1)?.score, 80);
});

test("all-time view retains the first month and empty intervening months", () => {
  const result = groupScoreTrend(
    [
      { date: "2026-01-02T12:00:00", score: 90, sessionCount: 1 },
      { date: "2025-10-20T12:00:00", score: 50, sessionCount: 1 },
    ],
    "all",
    new Date("2026-01-15T12:00:00"),
  );
  assert.deepEqual(
    result.map((item) => item.score),
    [50, null, null, 90],
  );
});
