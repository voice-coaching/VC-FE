import assert from "node:assert/strict";
import test from "node:test";
import { dialogNavigation } from "../src/lib/dialog-navigation";

const base = "https://app.test/mypage/settings?source=menu#settings";

test("opening creates one entry; repeated open does not duplicate it", () => {
  const open = dialogNavigation(base, null, "panel", "privacy");
  assert.equal(open.type, "push");
  if (open.type !== "push") return;
  assert.equal(new URL(open.url, base).searchParams.get("source"), "menu");
  assert.equal(
    dialogNavigation(
      new URL(open.url, base).href,
      open.state,
      "panel",
      "privacy",
    ).type,
    "none",
  );
  assert.equal(
    dialogNavigation(new URL(open.url, base).href, open.state, "panel", null)
      .type,
    "back",
  );
});

test("direct linked panel closes locally, without leaving the page", () => {
  const close = dialogNavigation(
    base.replace("#settings", "&panel=privacy#settings"),
    null,
    "panel",
    null,
  );
  assert.deepEqual(close, {
    type: "replace",
    url: "/mypage/settings?source=menu#settings",
    state: null,
  });
});

test("switching an owned panel replaces it and retains its close target", () => {
  const open = dialogNavigation(base, null, "panel", "privacy");
  if (open.type !== "push") throw new Error("Expected push");
  const next = dialogNavigation(
    new URL(open.url, base).href,
    open.state,
    "panel",
    "terms",
  );
  assert.equal(next.type, "replace");
  if (next.type !== "replace") return;
  assert.equal(
    dialogNavigation(new URL(next.url, base).href, next.state, "panel", null)
      .type,
    "back",
  );
});

test("unrelated history metadata cannot send close back to another page", () => {
  const open = dialogNavigation(base, null, "panel", "privacy");
  if (open.type !== "push") throw new Error("Expected push");
  assert.equal(
    dialogNavigation(
      "https://app.test/another?panel=privacy",
      open.state,
      "panel",
      null,
    ).type,
    "replace",
  );
});
