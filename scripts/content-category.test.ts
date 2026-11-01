import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createRemoteApi } from "../src/lib/api/remote";
import { clearAccessToken } from "../src/lib/api/client";
import {
  contentCategoryCode,
  contentFilterCodes,
} from "../src/lib/content-category";
import { categoryLabel } from "../src/lib/content-labels";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});

test("the Korean tense label and legacy names resolve before category facets arrive", () => {
  for (const value of [
    "된소리",
    "tense",
    "TENSE",
    "TENSE_CONSONANT",
    "DOUBLE_CONSONANT",
  ])
    assert.equal(contentCategoryCode("SENTENCE", value), "tense");
  assert.equal(categoryLabel("tense"), "된소리");
  assert.equal(categoryLabel("consonant"), "자음");
  assert.equal(categoryLabel("vowel"), "모음");
});

test("normalization preserves other server categories, catalog scopes and filters", () => {
  const filters = {
    type: "SENTENCE" as const,
    category: "BATCHIM",
    page: 2,
    size: 20,
  };
  assert.deepEqual(contentFilterCodes(filters), filters);
  assert.equal(contentCategoryCode("NEWS", "된소리"), "된소리");
  assert.equal(contentCategoryCode("SENTENCE", undefined), undefined);
  assert.equal(contentCategoryCode("SENTENCE", ""), "");
});

test("initial list, pagination, next and adjacent HTTP requests all send category=tense", async () => {
  const calls: URL[] = [];
  globalThis.fetch = async (url) => {
    calls.push(new URL(String(url), "https://example.test"));
    return Response.json({
      result: true,
      data: { items: [], totalElements: 0, page: 0, hasNext: false },
    });
  };
  const api = createRemoteApi("/api/backend");
  await api.content.list({
    type: "SENTENCE",
    category: "된소리",
    page: 0,
    size: 20,
  });
  await api.content.list({
    type: "SENTENCE",
    category: "된소리",
    page: 1,
    size: 20,
    difficulty: "BEGINNER",
  });
  await api.content.getNext({
    type: "SENTENCE",
    category: "TENSE_CONSONANT",
    excludeId: 1,
  });
  await api.content.getAdjacent(1, { type: "SENTENCE", category: "tense" });
  assert.equal(calls.length, 4);
  assert.deepEqual(
    calls.map((url) => url.pathname),
    [
      "/api/backend/api/practice-contents",
      "/api/backend/api/practice-contents",
      "/api/backend/api/practice-contents/next",
      "/api/backend/api/practice-contents/1/adjacent",
    ],
  );
  for (const url of calls)
    assert.equal(url.searchParams.get("category"), "tense");
  assert.equal(calls[1].searchParams.get("page"), "1");
  assert.equal(calls[1].searchParams.get("difficulty"), "BEGINNER");
  assert.equal(calls[2].searchParams.get("excludeId"), "1");
});
