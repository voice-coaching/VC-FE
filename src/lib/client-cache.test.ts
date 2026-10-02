import assert from "node:assert/strict";
import test from "node:test";
import {
  clearUserClientCache,
  readUserClientCache,
  removeUserClientCache,
  removeUserClientCacheGroup,
  writeUserClientCache,
} from "./client-cache";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("user cache isolates users, expires entries, and invalidates resource groups", () => {
  const storage = new MemoryStorage();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNow = Date.now;
  let now = 1_000;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
  Date.now = () => now;

  try {
    writeUserClientCache("user-a", "home-current", { value: "a" });
    writeUserClientCache("user-b", "home-current", { value: "b" });
    writeUserClientCache("user-a", "streak-month-current", { value: 1 });

    assert.deepEqual(readUserClientCache("user-a", "home-current"), {
      value: "a",
    });
    assert.deepEqual(readUserClientCache("user-b", "home-current"), {
      value: "b",
    });

    removeUserClientCacheGroup("user-a", "home-");
    assert.equal(readUserClientCache("user-a", "home-current"), null);
    assert.deepEqual(readUserClientCache("user-a", "streak-month-current"), {
      value: 1,
    });
    assert.deepEqual(readUserClientCache("user-b", "home-current"), {
      value: "b",
    });

    writeUserClientCache("user-a", "temporary", { value: true });
    now += 101;
    assert.equal(readUserClientCache("user-a", "temporary", 100), null);

    removeUserClientCache("user-a", "streak-month-current");
    assert.equal(readUserClientCache("user-a", "streak-month-current"), null);
    clearUserClientCache("user-b");
    assert.equal(readUserClientCache("user-b", "home-current"), null);
  } finally {
    Date.now = originalNow;
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
