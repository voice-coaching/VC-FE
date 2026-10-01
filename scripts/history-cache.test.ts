import assert from "node:assert/strict";
import test from "node:test";
import {
  historyCacheResource,
  removeCachedHistorySession,
  type HistoryCache,
} from "../src/lib/history-cache";
import {
  readUserClientCache,
  writeUserClientCache,
} from "../src/lib/client-cache";
import type { TrainingHistoryItem } from "../src/lib/api/types";

function withStorage(run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });
  try {
    run();
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

const windowCache: HistoryCache = {
  items: [1, 2].map(
    (sessionId) =>
      ({
        sessionId,
        contentId: 1,
        contentType: "NEWS",
        title: "연습",
        status: "COMPLETED",
        overallScore: 85,
        completedAt: "2026-10-01",
      }) as TrainingHistoryItem,
  ),
  page: 1,
  hasNext: true,
};

test("deletion prunes each filter without losing loaded pages or another user's cache", () =>
  withStorage(() => {
    for (const kind of [undefined, "NEWS"] as const) {
      writeUserClientCache("one", historyCacheResource(kind), windowCache);
      writeUserClientCache("two", historyCacheResource(kind), windowCache);
    }
    removeCachedHistorySession("one", "1");
    for (const kind of [undefined, "NEWS"] as const) {
      const result = readUserClientCache<HistoryCache>(
        "one",
        historyCacheResource(kind),
      );
      assert.deepEqual(
        result?.items.map((item) => item.sessionId),
        [2],
      );
      assert.equal(result?.page, 1);
      assert.equal(result?.hasNext, true);
      assert.equal(
        readUserClientCache<HistoryCache>("two", historyCacheResource(kind))
          ?.items.length,
        2,
      );
    }
  }));

test("missing or malformed cache cannot turn a successful deletion into a UI failure", () =>
  withStorage(() => {
    writeUserClientCache("one", historyCacheResource("NEWS"), { items: null });
    assert.doesNotThrow(() => removeCachedHistorySession("one", 1));
    assert.doesNotThrow(() => removeCachedHistorySession(null, 1));
  }));
