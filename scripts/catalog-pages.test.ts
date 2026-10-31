import assert from "node:assert/strict";
import test from "node:test";
import {
  createCatalogSnapshot,
  refreshCatalogWindow,
} from "../src/lib/catalog-pages";
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
        size: 20,
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
      return {
        page,
        size: 20,
        hasNext: false,
        totalElements: 1,
        items: [item(1)],
      };
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
      return {
        page,
        size: 20,
        hasNext: true,
        totalElements: 40,
        items: [item(1)],
      };
    },
    1,
    () => active,
  );
  assert.equal(result, null);
  assert.deepEqual(calls, [0]);
});

test("class pages use totalPages when hasNext is omitted", async () => {
  const calls: number[] = [];
  const result = await refreshCatalogWindow(
    async (page) => {
      calls.push(page);
      return {
        page,
        size: 20,
        totalElements: 2,
        totalPages: 2,
        items: [{ id: page + 1, courseType: "PRONUNCIATION" }],
      };
    },
    3,
    () => true,
  );
  assert.deepEqual(calls, [0, 1]);
  assert.equal(result?.hasNext, false);
  assert.deepEqual(
    result?.items.map((item) => item.id),
    [1, 2],
  );
});

test("rapid news filter changes share in-flight pages and reuse the full snapshot", async () => {
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: number[] = [];
  const source = createCatalogSnapshot(
    async (page) => {
      calls.push(page);
      await response;
      return {
        page,
        size: 2,
        totalElements: 3,
        hasNext: page === 0,
        items: page ? [item(2, "updated"), item(3)] : [item(1), item(2)],
      };
    },
    () => true,
  );
  const firstFilter = source.read();
  const secondFilter = source.read();
  assert.equal(firstFilter, secondFilter);
  assert.deepEqual(calls, [0]);
  release();
  const expected = [item(1), item(2, "updated"), item(3)];
  assert.deepEqual(await firstFilter, expected);
  assert.deepEqual(await secondFilter, expected);
  assert.deepEqual(await source.read(), expected);
  assert.deepEqual(calls, [0, 1]);
});

test("a failed news page can be retried without publishing a partial snapshot", async () => {
  let fail = true;
  const calls: number[] = [];
  const source = createCatalogSnapshot(
    async (page) => {
      calls.push(page);
      if (page === 1 && fail) throw new Error("offline");
      return {
        page,
        size: 1,
        totalElements: 2,
        totalPages: 2,
        items: [item(page + 1)],
      };
    },
    () => true,
  );
  await assert.rejects(source.read(), /offline/);
  fail = false;
  assert.deepEqual(await source.read(), [item(1), item(2)]);
  assert.deepEqual(calls, [0, 1, 0, 1]);
});

test("logout or a superseding news refresh stops the old pending pagination", async () => {
  let active = true;
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: number[] = [];
  const source = createCatalogSnapshot(
    async (page) => {
      calls.push(page);
      await response;
      return {
        page,
        size: 1,
        totalElements: 2,
        hasNext: true,
        items: [item(1)],
      };
    },
    () => active,
  );
  const pending = source.read();
  active = false;
  release();
  assert.equal(await pending, null);
  assert.equal(await source.read(), null);
  assert.deepEqual(calls, [0]);
});

test("an old account cannot reuse a completed news snapshot", async () => {
  let active = true;
  let calls = 0;
  const source = createCatalogSnapshot(
    async (page) => {
      calls++;
      return { page, size: 1, totalElements: 1, items: [item(1)] };
    },
    () => active,
  );
  assert.deepEqual(await source.read(), [item(1)]);
  active = false;
  assert.equal(await source.read(), null);
  assert.equal(calls, 1);
});

test("news pagination supports totalElements when optional page flags are absent", async () => {
  const calls: number[] = [];
  const source = createCatalogSnapshot(
    async (page) => {
      calls.push(page);
      return { page, size: 1, totalElements: 2, items: [item(page + 1)] };
    },
    () => true,
  );
  assert.deepEqual(await source.read(), [item(1), item(2)]);
  assert.deepEqual(calls, [0, 1]);
});

test("inconsistent empty news pages fail instead of looping indefinitely", async () => {
  let calls = 0;
  const source = createCatalogSnapshot(
    async (page) => {
      calls++;
      return { page, size: 1, totalElements: 5, hasNext: true, items: [] };
    },
    () => true,
  );
  await assert.rejects(source.read());
  assert.equal(calls, 1);
});
