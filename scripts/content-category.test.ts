import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRemoteApi } from "../src/lib/api/remote";
import { clearAccessToken } from "../src/lib/api/client";
import {
  sentenceCategoryOptions,
  sentenceCategoryRequest,
} from "../src/lib/content-category";
import { catalogFacetsForPractice } from "../src/lib/catalog-visibility";
import { refreshCatalogWindow } from "../src/lib/catalog-pages";
import type { ContentFacets } from "../src/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});
const codes = ["FINAL_CONSONANT", "TENSE_CONSONANT", "CONSONANT", "VOWEL"];
const facets: ContentFacets = {
  type: "SENTENCE",
  revision: "V58",
  difficulties: [],
  categories: [
    ...["받침", "된소리", "자음", "모음"].map((label, index) => ({
      value: codes[index],
      label,
      count: 5,
      order: index + 1,
    })),
    { value: "EXAMPLE_QUESTION", label: "예시문제", count: 10, order: 5 },
    { value: "TITLE_EXAM", label: "승급시험", count: 5, order: 6 },
    { value: "tense", label: "옛 된소리", count: 2, order: 7 },
  ],
};
const options = sentenceCategoryOptions(facets);
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("only supplied V58 facet options are selectable; their values and labels stay authoritative", () => {
  assert.deepEqual(
    options.map((item) => item.value),
    codes,
  );
  assert.equal(options[1], facets.categories[1]);
  const missing = {
    ...facets,
    categories: facets.categories.filter((item) => item.value !== "VOWEL"),
  };
  assert.deepEqual(
    sentenceCategoryOptions(missing).map((item) => item.value),
    codes.slice(0, 3),
  );
  assert.throws(() => sentenceCategoryOptions({ ...facets, type: "NEWS" }));
});

test("filtered requests wait for facets and never fall back to labels, aliases or ALL", () => {
  assert.equal(
    sentenceCategoryRequest("TENSE_CONSONANT", options, false),
    null,
  );
  assert.equal(
    sentenceCategoryRequest("TENSE_CONSONANT", options, true),
    "TENSE_CONSONANT",
  );
  for (const invalid of ["된소리", "받침", "tense", "ALL", "전체", "UNKNOWN"])
    assert.equal(sentenceCategoryRequest(invalid, options, true), null);
  assert.equal(sentenceCategoryRequest("", [], false), undefined);
  assert.equal(
    sentenceCategoryRequest("VOWEL", options.slice(0, 3), true),
    null,
  );
});

test("list, pagination, next and adjacent requests preserve exact uppercase category values and all omits category", async () => {
  const calls: URL[] = [];
  globalThis.fetch = async (url) => {
    calls.push(new URL(String(url), "https://example.test"));
    return Response.json({
      result: true,
      data: { items: [], totalElements: 0, page: 0, hasNext: false },
    });
  };
  const api = createRemoteApi("/api/backend");
  for (const option of options)
    await api.content.list({
      type: "SENTENCE",
      category: option.value,
      page: 0,
      size: 20,
    });
  await api.content.list({
    type: "SENTENCE",
    category: options[1].value,
    page: 1,
    size: 20,
  });
  await api.content.getNext({
    type: "SENTENCE",
    category: options[1].value,
    excludeId: 1,
  });
  await api.content.getAdjacent(1, {
    type: "SENTENCE",
    category: options[1].value,
  });
  await api.content.list({
    type: "SENTENCE",
    category: undefined,
    page: 0,
    size: 20,
  });
  assert.deepEqual(
    calls.slice(0, 4).map((url) => url.searchParams.get("category")),
    codes,
  );
  for (const url of calls.slice(4, 7))
    assert.equal(url.searchParams.get("category"), "TENSE_CONSONANT");
  assert.equal(calls[4].searchParams.get("page"), "1");
  assert.equal(calls[7].searchParams.has("category"), false);
});

// Exercise the actual event handlers/effects without a browser or a second implementation.
const source = readFileSync("src/components/content-catalog.tsx", "utf8");
const file = ts.createSourceFile(
  "catalog.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const declarations = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name)
    declarations.set(node.name.text, node.getText(file));
  if (
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(
      (decl) => decl.name.getText(file) === "SENTENCE_FILTER_PRESENTATION",
    )
  )
    declarations.set("presentation", node.getText(file));
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(file) === "useEffect"
  ) {
    const callback = node.arguments[0];
    if (callback && ts.isArrowFunction(callback)) {
      const text = callback.getText(file);
      if (text.includes("async function fetchNewsTopics"))
        declarations.set("listEffect", text);
      if (text.includes("const applyFacets"))
        declarations.set("facetEffect", text);
    }
  }
  ts.forEachChild(node, visit);
}
visit(file);
function load(name: string, deps: Record<string, unknown>) {
  const declaration = declarations.get(name);
  assert.ok(declaration, `Missing actual ${name} handler`);
  const expression = name.endsWith("Effect")
    ? `const handler=${declaration};`
    : declaration;
  const code = ts.transpile(
    `${declarations.get("presentation")}\n${declarations.get("catalogCacheResource")}\n${expression}`,
    {
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  );
  return new Function(
    ...Object.keys(deps),
    code + `\nreturn ${name.endsWith("Effect") ? "handler" : name};`,
  )(...Object.values(deps));
}
function buttons(
  element: unknown,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(element)) return element.flatMap(buttons);
  if (!React.isValidElement<Record<string, unknown>>(element)) return [];
  return [
    ...(element.type === "button" ? [element] : []),
    ...buttons(element.props.children),
  ];
}

test("actual sentence filter renders server labels, emits values, and has no selectable fallback while loading", () => {
  const Filter = load("SentenceFilters", { React, SkeletonBlock: () => null });
  const selected: string[] = [];
  const props = {
    category: "",
    options,
    loading: false,
    onCategory: (value: string) => selected.push(value),
    onRetry: () => {},
  };
  const element = Filter(props);
  assert.match(renderToStaticMarkup(element), /된소리/);
  for (const button of buttons(element)) (button.props.onClick as () => void)();
  assert.deepEqual(selected, codes);
  const pending = Filter({ ...props, options: [], loading: true });
  assert.equal(buttons(pending).length, 0);
  assert.match(renderToStaticMarkup(pending), /문장 카테고리 불러오는 중/);
});

test("actual facet failure offers retry and a successful retry replaces stale cached label mappings", async () => {
  let retries = 0;
  const Filter = load("SentenceFilters", { React, SkeletonBlock: () => null });
  const failed = Filter({
    category: "",
    options: [],
    loading: false,
    error: "조회 실패",
    onCategory: () => assert.fail(),
    onRetry: () => {
      retries++;
    },
  });
  (buttons(failed)[0].props.onClick as () => void)();
  assert.equal(retries, 1);
  const states: Array<{ status: string; options: unknown[] }> = [];
  let attempts = 0;
  const deps = {
    type: "SENTENCE",
    facetScope: "user:SENTENCE",
    userId: "user",
    setSentenceFacets: (value: { status: string; options: unknown[] }) =>
      states.push(value),
    cacheResources: { contentFacets: () => "facets" },
    readUserClientCache: () => ({
      ...facets,
      categories: [{ value: "tense", label: "된소리" }],
    }),
    writeUserClientCache: () => {},
    catalogFacetsForPractice,
    sentenceCategoryOptions,
    api: {
      content: {
        getFacets: async () => {
          if (++attempts === 1) throw new Error("offline");
          return facets;
        },
      },
    },
  };
  const cleanup = load("facetEffect", deps)();
  await tick();
  assert.equal(states.at(-1)?.status, "error");
  assert.deepEqual(states.at(-1)?.options, []);
  cleanup();
  const retryCleanup = load("facetEffect", deps)();
  await tick();
  assert.equal(states.at(-1)?.status, "ready");
  assert.deepEqual(states.at(-1)?.options, options);
  retryCleanup();
});

function listContext(
  category: string,
  requestedCategory: string | null | undefined,
  previousCategory = category,
) {
  const calls: Array<{ category?: string; page: number }> = [];
  const state: Record<string, unknown> = {};
  const cache = {
    items: [{ id: 1 }],
    totalElements: 100,
    page: 2,
    hasNext: true,
  };
  const deps: Record<string, unknown> = {
    category,
    requestedCategory,
    type: "SENTENCE",
    userId: "user",
    difficulty: "",
    scope: `user:${category}`,
    generation: { current: 1 },
    loadMoreBusy: { current: false },
    previousFilters: {
      current: JSON.stringify(["user", "SENTENCE", previousCategory, ""]),
    },
    readUserClientCache: () => cache,
    writeUserClientCache: () => {},
    refreshCatalogWindow,
    api: {
      content: {
        list: async (filters: { category?: string; page: number }) => {
          calls.push(filters);
          return {
            ...cache,
            items: [{ id: filters.page + 1 }],
            page: filters.page,
            size: 20,
          };
        },
      },
    },
  };
  for (const name of [
    "setLoadingMore",
    "setLoadMoreError",
    "setRefreshing",
    "setItems",
    "setTotalElements",
    "setPage",
    "setHasNext",
    "setLoading",
    "setError",
    "setLoadedScope",
  ])
    deps[name] = (value: unknown) => {
      state[name] = value;
    };
  return { deps, state, calls };
}

test("actual list effect holds until facets resolve, then starts a changed category at page zero despite an old cached window", async () => {
  const ctx = listContext("TENSE_CONSONANT", null, "");
  load("listEffect", ctx.deps)();
  await tick();
  assert.equal(ctx.calls.length, 0);
  ctx.deps.requestedCategory = "TENSE_CONSONANT";
  const cleanup = load("listEffect", ctx.deps)();
  await tick();
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.calls[0].page, 0);
  assert.equal(ctx.calls[0].category, "TENSE_CONSONANT");
  assert.equal(ctx.state.setPage, 0);
  cleanup();
});

test("actual more handler uses the same validated value; all and subsequent category changes keep pagination separate", async () => {
  const ctx = listContext("TENSE_CONSONANT", "TENSE_CONSONANT");
  const cleanup = load("listEffect", ctx.deps)();
  await tick();
  assert.deepEqual(
    ctx.calls.map((call) => call.page),
    [0, 1, 2],
  );
  cleanup();
  const loadMore = load("loadMore", {
    ...ctx.deps,
    page: 0,
    loadedScope: ctx.deps.scope,
    refreshing: false,
    hasNext: true,
    items: [],
    cacheResources: {},
    loadingMore: false,
  });
  await loadMore();
  assert.equal(ctx.calls.at(-1)?.category, "TENSE_CONSONANT");
  assert.equal(ctx.calls.at(-1)?.page, 1);
  const all = listContext("", undefined, "TENSE_CONSONANT");
  load("listEffect", all.deps)();
  await tick();
  assert.equal(all.calls.length, 1);
  assert.equal(all.calls[0].category, undefined);
  assert.equal(all.calls[0].page, 0);
  const next = listContext("VOWEL", "VOWEL", "TENSE_CONSONANT");
  load("listEffect", next.deps)();
  await tick();
  assert.equal(next.calls.length, 1);
  assert.equal(next.calls[0].category, "VOWEL");
  assert.equal(next.calls[0].page, 0);
});
