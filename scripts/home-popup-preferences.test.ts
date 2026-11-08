import assert from "node:assert/strict";
import test from "node:test";
import {
  hideHomePopupForWeek,
  hideHomePopupForDays,
  isHomePopupHidden,
} from "../src/lib/home-popup-preferences";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
const week = 7 * 24 * 60 * 60 * 1000;

test("daily hide expires exactly 24 hours later and shares the existing per-popup preference", () => {
  const storage = memoryStorage();
  const now = 1_000_000;
  hideHomePopupForDays("1", 42, 1, now, storage);
  assert.equal(isHomePopupHidden("1", 42, now + 86_400_000 - 1, storage), true);
  assert.equal(isHomePopupHidden("1", 42, now + 86_400_000, storage), false);
  hideHomePopupForDays("1", 42, 7, now, storage);
  assert.equal(isHomePopupHidden("1", 42, now + week - 1, storage), true);
});
test("weekly hide expires at exactly seven days and removes the expired entry", () => {
  const storage = memoryStorage();
  const now = 1_000_000;
  assert.equal(isHomePopupHidden("1", 42, now, storage), false);
  assert.equal(hideHomePopupForWeek("1", 42, now, storage), true);
  assert.equal(isHomePopupHidden("1", 42, now + week - 1, storage), true);
  assert.equal(isHomePopupHidden("1", 42, now + week, storage), false);
  assert.equal(storage.values.size, 0);
});
test("another account or another popup is not hidden", () => {
  const storage = memoryStorage();
  hideHomePopupForWeek("1", 42, 100, storage);
  assert.equal(isHomePopupHidden("2", 42, 101, storage), false);
  assert.equal(isHomePopupHidden("1", 43, 101, storage), false);
  assert.equal(isHomePopupHidden("1", 42, 101, storage), true);
});
test("invalid and blocked storage do not break home or hide unrelated notices", () => {
  const storage = memoryStorage();
  hideHomePopupForWeek("1", 42, 100, storage);
  for (const key of storage.values.keys()) storage.values.set(key, "corrupt");
  assert.equal(isHomePopupHidden("1", 42, 101, storage), false);
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(hideHomePopupForWeek("1", 42, 100, blocked), false);
  assert.equal(isHomePopupHidden("1", 42, 101, blocked), false);
});
