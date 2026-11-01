import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  popularNewsPayload,
  popularNewsSubtitle,
} from "../src/lib/popular-news";
import { createRemoteApi } from "../src/lib/api/remote";
import { newsHeadline, newsCategoryTags } from "../src/lib/news-presentation";
import { practiceDetailHref } from "../src/lib/practice-entry";
import type { PopularNews } from "../src/lib/api/types";

const fixture: PopularNews = {
  type: "NEWS",
  rankingBasis: "COMPLETED_USERS",
  periodStart: "2050-11-03T15:00:00Z",
  periodEnd: "2050-11-04T15:00:00Z",
  generatedAt: "2050-11-04T15:00:00Z",
  nextUpdateAt: "2050-11-05T15:00:00Z",
  items: Array.from({ length: 10 }, (_, i) => ({
    id: 100 + i,
    rank: i + 1,
    usageCount: 20 - i,
    contentType: "NEWS",
    title: `기사 제목 ${i + 1}`,
    category: "ECONOMY",
    difficulty: "BEGINNER",
    estimatedSeconds: 20,
  })),
};
function evaluate(
  path: string,
  name: string,
  deps: Record<string, unknown>,
  whole = false,
) {
  const text = readFileSync(path, "utf8");
  const file = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const code = whole
    ? file.statements
        .filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getText(file))
        .join("\n")
    : file.statements
        .find((n) => ts.isFunctionDeclaration(n) && n.name?.text === name)
        ?.getText(file);
  assert.ok(code);
  const js = ts.transpile(code.replace(/export /g, ""), {
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
  });
  return new Function(...Object.keys(deps), `${js}\nreturn ${name};`)(
    ...Object.values(deps),
  );
}
function nodes(value: unknown): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...nodes(value.props.children)];
}
const noop = () => {};

test("daily popularity contract rejects broken ranks, duplicate articles and invalid counts", () => {
  assert.equal(popularNewsPayload(fixture), fixture);
  assert.equal(popularNewsPayload({ ...fixture, items: [] }).items.length, 0);
  for (const patch of [
    { items: [...fixture.items, fixture.items[0]] },
    { items: [fixture.items[1]] },
    { items: [{ ...fixture.items[0], usageCount: -1 }] },
    { items: [{ ...fixture.items[0], contentType: "SENTENCE" }] },
    { items: [fixture.items[0], { ...fixture.items[1], id: 100 }] },
    { nextUpdateAt: fixture.periodEnd },
    { generatedAt: "invalid" },
  ])
    assert.throws(() => popularNewsPayload({ ...fixture, ...patch }));
  assert.match(
    popularNewsSubtitle({ ...fixture, rankingBasis: "CATALOG_ORDER" }, null),
    /목록 순서/,
  );
  assert.match(popularNewsSubtitle(fixture, "offline"), /이전 집계/);
});

test("news ranking calls the implemented ten-item endpoint through the proxy", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(
        String(url),
        "/api/backend/api/practice-contents/popular?type=NEWS&limit=10",
      );
      assert.equal(init?.method ?? "GET", "GET");
      return Response.json({ result: true, data: fixture });
    };
    assert.deepEqual(
      await createRemoteApi("/api/backend").content.getPopularNews(),
      fixture,
    );
  } finally {
    globalThis.fetch = previous;
  }
});

test("both carousel presentations expose all ten real articles and direct rank navigation", () => {
  for (const compact of [true, false]) {
    let state = 0;
    const calls: number[] = [];
    const carousel = {
      scrollTo: (index: number) => calls.push(index),
      scrollNext: () => calls.push(1),
      scrollPrev: () => calls.push(-1),
    };
    const Box = ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children);
    const Component = evaluate(
      "src/components/popular-news-carousel.tsx",
      "PopularNewsCarousel",
      {
        React,
        useEffect: noop,
        useState: () => [state++ === 0 ? carousel : 0, noop],
        usePopularNews: () => ({
          data: fixture,
          loading: false,
          error: null,
          retry: noop,
        }),
        popularNewsSubtitle,
        newsHeadline,
        newsCategoryTags,
        practiceDetailHref,
        newsStyles: { card: "card", rank: "rank", meta: "meta" },
        Carousel: Box,
        CarouselContent: Box,
        CarouselItem: Box,
        SkeletonBlock: Box,
        Link: ({ children, ...props }: Record<string, unknown>) =>
          React.createElement("a", props, children),
        ChevronLeft: () => null,
        ChevronRight: () => null,
      },
    );
    const tree = Component({ compact, returnTo: "/news" });
    const all = nodes(tree);
    const links = all.filter((n) => typeof n.props.href === "string");
    assert.equal(links.length, 10);
    for (let i = 0; i < 10; i++) {
      assert.equal(links[i].props.href, practiceDetailHref(100 + i, "/news"));
      assert.equal(
        links[i].props["aria-label"],
        `인기 뉴스 ${i + 1}위: 기사 제목 ${i + 1}`,
      );
    }
    const tenth = all.find((n) => n.props["aria-label"] === "10위 뉴스 보기");
    assert.ok(tenth);
    (tenth.props.onClick as () => void)();
    assert.deepEqual(calls, [9]);
    const prev = all.find((n) => n.props["aria-label"] === "이전 순위 보기");
    assert.equal(prev?.props.disabled, true);
    const next = all.find((n) => n.props["aria-label"] === "다음 순위 보기");
    assert.equal(next?.props.disabled, false);
    (next?.props.onClick as () => void)();
    assert.deepEqual(calls, [9, 1]);
    const html = renderToStaticMarkup(tree);
    assert.ok(html.includes("기사 제목 10"));
    assert.ok(html.includes("TOP 10"));
  }
});

test("home and news catalog share ranking without the old five-row pseudo ranking", () => {
  for (const path of [
    "src/routes/home.tsx",
    "src/components/content-catalog.tsx",
  ]) {
    const text = readFileSync(path, "utf8");
    assert.match(text, /<PopularNewsCarousel\b/);
    assert.doesNotMatch(
      text,
      /news-top-all|HomeNewsTicker|NewsIntro|setTopItems|setNewsItems/,
    );
  }
});

test("cached rankings render immediately and refresh once at the server's daily deadline", async () => {
  let userId = "learner-a",
    epoch = 1,
    attempt = 0;
  let current: unknown;
  let stateIndex = 0;
  let requests = 0;
  let duration = 0;
  const effects: Array<() => void | (() => void)> = [];
  const listeners = new Map<string, () => void>();
  let timeout = () => {};
  let cleared = false;
  let cacheWrites = 0;
  const hook = evaluate(
    "src/hooks/use-popular-news.ts",
    "usePopularNews",
    {
      useState: (initial: unknown) => {
        const index = stateIndex++;
        if (index === 0)
          return [
            attempt,
            (update: (n: number) => number) => {
              attempt = update(attempt);
            },
          ];
        current =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
        return [
          current,
          (value: unknown) => {
            current =
              typeof value === "function"
                ? (value as (n: unknown) => unknown)(current)
                : value;
          },
        ];
      },
      useEffect: (effect: () => void | (() => void)) => effects.push(effect),
      getAuthenticatedUserId: () => userId,
      getAuthSessionVersion: () => epoch,
      popularNewsPayload,
      readUserClientCache: () => fixture,
      writeUserClientCache: () => {
        cacheWrites++;
      },
      api: {
        content: {
          getPopularNews: async () => {
            requests++;
            return fixture;
          },
        },
      },
      window: {
        setTimeout: (fn: () => void, ms: number) => {
          timeout = fn;
          duration = ms;
          return 7;
        },
        clearTimeout: () => {
          cleared = true;
        },
      },
      document: {
        hidden: false,
        addEventListener: (name: string, fn: () => void) =>
          listeners.set(name, fn),
        removeEventListener: (name: string) => listeners.delete(name),
      },
    },
    true,
  );
  const result = hook();
  assert.equal(result.data, fixture);
  const stopRequest = effects[0]();
  const stopTimer = effects[1]();
  assert.equal(requests, 1);
  assert.ok(duration > 23 * 60 * 60 * 1000); // one daily timer, no short polling
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cacheWrites, 1);
  timeout();
  assert.equal(attempt, 1);
  if (typeof stopTimer === "function") stopTimer();
  if (typeof stopRequest === "function") stopRequest();
  assert.equal(cleared, true);
  assert.equal(listeners.size, 0);
  // A reply after the authenticated account changes must never enter the new account's cache.
  effects.length = 0;
  stateIndex = 0;
  hook();
  effects[0]();
  userId = "learner-b";
  epoch++;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cacheWrites, 1);
});
