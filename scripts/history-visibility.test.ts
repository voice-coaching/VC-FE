import assert from "node:assert/strict";
import test from "node:test";
import {
  historyContentKinds,
  visibleHistoryItems,
  hasDirectHistoryFeedback,
} from "../src/lib/history-visibility";
import type {
  PracticeContent,
  TrainingHistoryItem,
} from "../src/lib/api/types";

const row = (
  sessionId: number,
  contentId = sessionId,
): TrainingHistoryItem => ({
  sessionId,
  contentId,
  contentType: "SENTENCE",
  title: `record ${sessionId}`,
  status: "COMPLETED",
  overallScore: null,
  completedAt: "2026-11-10T09:00:00Z",
});
const content = (id: number, origin = "CATALOG", category = "OTHER") =>
  ({ id, origin, category }) as PracticeContent;

test("completed rows survive missing feedback, metadata failure and unresolved classification", () => {
  const rows = [row(1), row(2), row(3)];
  assert.deepEqual(
    visibleHistoryItems(rows, { "1": "catalog", "2": "error" }, false),
    rows,
  );
  assert.deepEqual(
    visibleHistoryItems(
      rows,
      { "1": "exam", "2": "custom", "3": "catalog" },
      false,
    ),
    rows.slice(1),
  );
  assert.deepEqual(
    visibleHistoryItems(
      rows,
      { "1": "exam", "2": "custom", "3": "error" },
      true,
    ),
    [rows[1]],
  );
});
test("classification fetches each content once, preserves unrelated records on failure, and supports retry", async () => {
  const rows = [row(1, 10), row(2, 10), row(3, 20), row(4, 30), row(5, 40)];
  const calls: number[] = [];
  const kinds = await historyContentKinds(rows, async (id) => {
    calls.push(Number(id));
    if (id === 40) throw new Error("temporary 503");
    return content(
      Number(id),
      id === 20 ? "USER_INPUT" : "CATALOG",
      id === 30 ? "TITLE_EXAM" : "OTHER",
    );
  });
  assert.deepEqual(calls, [10, 20, 30, 40]);
  assert.deepEqual(kinds, {
    "10": "catalog",
    "20": "custom",
    "30": "exam",
    "40": "error",
  });
  assert.deepEqual(
    visibleHistoryItems(rows, kinds, false).map((item) => item.sessionId),
    [1, 2, 3, 5],
  );
  const retried = await historyContentKinds([rows[4]], async () =>
    content(40, "USER_INPUT"),
  );
  assert.equal(retried["40"], "custom");
});
test("mismatched metadata identity is not used to classify someone else's record", async () => {
  assert.deepEqual(
    await historyContentKinds([row(1)], async () => content(999, "USER_INPUT")),
    { "1": "error" },
  );
});
test("non-sentence records need no content classification HTTP calls", async () => {
  let calls = 0;
  assert.deepEqual(
    await historyContentKinds(
      [{ ...row(1), contentType: "NEWS" }],
      async () => {
        calls++;
        return content(1);
      },
    ),
    {},
  );
  assert.equal(calls, 0);
});
test("direct feedback accepts both formats and keeps failed/nonaccepted results hidden", () => {
  const accepted = {
    failure: null,
    decision: { status: "ACCEPT" },
    coaching: { items: [], feedback: "summary only" },
  };
  assert.equal(hasDirectHistoryFeedback(accepted), true);
  const items = {
    ...accepted,
    coaching: { items: [{ expression: { action: "practice the ending" } }] },
  };
  assert.equal(hasDirectHistoryFeedback(items), true);
  assert.equal(
    hasDirectHistoryFeedback({
      ...accepted,
      failure: "CANONICAL_ANALYSIS_FAILED",
    }),
    false,
  );
  assert.equal(
    hasDirectHistoryFeedback({
      ...items,
      decision: { status: "SYSTEM_FAILURE" },
    }),
    false,
  );
  assert.equal(
    hasDirectHistoryFeedback({ ...items, decision: { status: "REJECT" } }),
    false,
  );
  assert.equal(
    hasDirectHistoryFeedback({
      ...accepted,
      coaching: { items: [], feedback: "   " },
    }),
    false,
  );
  assert.equal(hasDirectHistoryFeedback(null), false);
});
