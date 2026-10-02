import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeHistoryItems,
  refreshHistoryWindow,
} from "../src/lib/history-pages";
import type { PageResult, TrainingHistoryItem } from "../src/lib/api/types";

const item = (
  sessionId: number | string,
  title = "연습",
): TrainingHistoryItem => ({
  sessionId,
  contentId: 1,
  contentType: "NEWS",
  title,
  status: "COMPLETED",
  overallScore: 85,
  completedAt: "2026-10-01",
});
const page = (
  index: number,
  hasNext = true,
): PageResult<TrainingHistoryItem> => ({
  items: [item(index + 1)],
  page: index,
  size: 1,
  totalElements: 3,
  hasNext,
});

test("refresh keeps all previously loaded pages in one completed window", async () => {
  const calls: number[] = [];
  const result = await refreshHistoryWindow(
    async (index) => {
      calls.push(index);
      return page(index);
    },
    2,
    () => true,
  );
  assert.deepEqual(calls, [0, 1, 2]);
  assert.deepEqual(
    result?.items.map((value) => value.sessionId),
    [1, 2, 3],
  );
  assert.equal(result?.page, 2);
  assert.equal(result?.hasNext, true);
});

test("server end of list stops refresh even if the old window was longer", async () => {
  const calls: number[] = [];
  const result = await refreshHistoryWindow(
    async (index) => {
      calls.push(index);
      return page(index, false);
    },
    2,
    () => true,
  );
  assert.deepEqual(calls, [0]);
  assert.equal(result?.hasNext, false);
});

test("a cancelled filter request never publishes a partial window", async () => {
  let active = true;
  const calls: number[] = [];
  const result = await refreshHistoryWindow(
    async (index) => {
      calls.push(index);
      active = false;
      return page(index);
    },
    2,
    () => active,
  );
  assert.equal(result, null);
  assert.deepEqual(calls, [0]);
});

test("an inactive request does not fetch", async () => {
  assert.equal(
    await refreshHistoryWindow(
      async () => {
        throw new Error("Must not fetch");
      },
      2,
      () => false,
    ),
    null,
  );
});

test("failure on a later page rejects instead of replacing the cache with page zero", async () => {
  await assert.rejects(
    refreshHistoryWindow(
      async (index) => {
        if (index === 1) throw new Error("offline");
        return page(index);
      },
      2,
      () => true,
    ),
    /offline/,
  );
});

test("invalid restored page numbers only request the first page", async () => {
  for (const lastPage of [-1, NaN, Infinity, 1.5]) {
    const calls: number[] = [];
    await refreshHistoryWindow(
      async (index) => {
        calls.push(index);
        return page(index);
      },
      lastPage,
      () => true,
    );
    assert.deepEqual(calls, [0]);
  }
});

test("overlapping pages update a session without duplicating its row", () => {
  const merged = mergeHistoryItems(
    [item(1), item(2)],
    [item("2", "최신 제목"), item(3)],
  );
  assert.deepEqual(
    merged.map((value) => String(value.sessionId)),
    ["1", "2", "3"],
  );
  assert.equal(merged[1].title, "최신 제목");
});
