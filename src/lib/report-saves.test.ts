import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { markAuthenticatedUser, resetAuthSession } from "./auth-session";
import type { UserAccount } from "./api/types";
import { reportSaves } from "./report-saves";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const storage = new Map<string, string>();
const login = (id: number) =>
  markAuthenticatedUser({ id, onboardingCompleted: true } as UserAccount);
beforeEach(() => {
  storage.clear();
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    },
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = async () => {
    throw new Error("report choices must not call an absent backend API");
  };
  login(1);
});
afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
  resetAuthSession();
});

test("save and skip persist across reloads without a report-saves request", async () => {
  assert.equal((await reportSaves.get("SESSION", 17)).saved, true);
  await reportSaves.set("SESSION", 17, false);
  await reportSaves.set("DIRECT", "job", true);
  resetAuthSession();
  login(1);
  assert.equal((await reportSaves.get("SESSION", 17)).saved, false);
  assert.equal((await reportSaves.get("DIRECT", "job")).saved, true);
  await reportSaves.set("SESSION", 17, true);
  assert.equal((await reportSaves.list()).length, 2);
});

test("same report IDs are isolated between accounts and sources", async () => {
  await reportSaves.set("SESSION", 7, false);
  await reportSaves.set("DIRECT", 7, true);
  login(2);
  assert.deepEqual(await reportSaves.list(), []);
  await reportSaves.set("SESSION", 7, true);
  login(1);
  assert.equal((await reportSaves.get("SESSION", 7)).saved, false);
  assert.equal((await reportSaves.get("DIRECT", 7)).saved, true);
});

test("storage failure rejects saving instead of reporting success", async () => {
  window.localStorage.setItem = () => {
    throw new Error("quota");
  };
  await assert.rejects(reportSaves.set("SESSION", 7, true), /quota/);
  resetAuthSession();
  await assert.rejects(reportSaves.list(), /로그인/);
});
