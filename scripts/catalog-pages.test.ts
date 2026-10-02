import assert from "node:assert/strict";
import test from "node:test";
import { refreshCatalogWindow } from "../src/lib/catalog-pages";
import type { PracticeContentSummary } from "../src/lib/api/types";

const item = (id: number, title = "연습") =>
  ({ id, title }) as PracticeContentSummary;

test("catalog refresh retains loaded pages and deduplicates overlapping IDs", async () => {
  const calls: number[] = [];
  const result = await refreshCatalogWindow(
    async (page) => {
      calls.push(page);
      return {
        page,
        hasNext: true,
        totalElements: 50,
        items: page ? [item(1, "갱신"), item(2)] : [item(1)],
      };
    },
    1,
    () => true,
  );
  assert.deepEqual(calls, [0, 1]);
  assert.deepEqual(result?.items, [item(1, "갱신"), item(2)]);
  assert.equal(result?.page, 1);
  assert.equal(result?.totalElements, 50);
});

test("catalog refresh stops at the last server page", async () => {
  const calls: number[] = [];
  const result = await refreshCatalogWindow(
    async (page) => {
      calls.push(page);
      return { page, hasNext: false, totalElements: 1, items: [item(1)] };
    },
    5,
    () => true,
  );
  assert.deepEqual(calls, [0]);
  assert.equal(result?.hasNext, false);
});

test("superseded refresh cannot publish or request further pages", async () => {
  let active = true;
  const calls: number[] = [];
  const result = await refreshCatalogWindow(
    async (page) => {
      calls.push(page);
      active = false;
      return { page, hasNext: true, totalElements: 40, items: [item(1)] };
    },
    1,
    () => active,
  );
  assert.equal(result, null);
  assert.deepEqual(calls, [0]);
});
