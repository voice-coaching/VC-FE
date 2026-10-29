import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogFacetsForPractice,
  catalogItemsForPractice,
} from "../src/lib/catalog-visibility";
import type {
  ContentFacets,
  PracticeContentSummary,
} from "../src/lib/api/types";

const sentence = (id: number, category: string): PracticeContentSummary => ({
  id,
  contentType: "SENTENCE",
  title: `문장 ${id}`,
  category,
  difficulty: "BEGINNER",
  estimatedSeconds: 10,
});

test("title exam questions never appear in sentence practice discovery", () => {
  const visible = catalogItemsForPractice("SENTENCE", [
    sentence(1, "FINAL_CONSONANT"),
    sentence(2, "EXAMPLE_QUESTION"),
    sentence(3, "TITLE_EXAM"),
    sentence(4, "승급시험"),
  ]);
  assert.deepEqual(
    visible.map((item) => item.id),
    [1],
  );
});

test("title exam category is removed from sentence facets", () => {
  const facets: ContentFacets = {
    type: "SENTENCE",
    categories: [
      { value: "EXAMPLE_QUESTION", label: "예시문제", count: 3, order: 0 },
      { value: "TITLE_EXAM", label: "승급시험", count: 4, order: 20 },
      { value: "FINAL_CONSONANT", label: "받침", count: 4, order: 1 },
    ],
    difficulties: [],
    revision: "test",
  };
  assert.deepEqual(
    catalogFacetsForPractice("SENTENCE", facets).categories.map(
      (option) => option.value,
    ),
    ["FINAL_CONSONANT"],
  );
});

test("other catalogs keep their original items", () => {
  const items = [sentence(2, "EXAMPLE_QUESTION")];
  assert.equal(catalogItemsForPractice("NEWS", items), items);
});
