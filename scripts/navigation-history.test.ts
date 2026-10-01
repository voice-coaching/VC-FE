import assert from "node:assert/strict";
import test from "node:test";
import {
  canNavigateBack,
  installNavigationHistory,
  navigationEntryId,
} from "../src/lib/navigation-history";

function fakeHistory() {
  const entries: unknown[] = [null, { __NA: true, tree: "initial" }];
  let index = 1;
  return {
    get state() {
      return entries[index];
    },
    get length() {
      return entries.length;
    },
    pushState(data: unknown) {
      entries.splice(++index);
      entries.push(data);
    },
    replaceState(data: unknown) {
      entries[index] = data;
    },
    back() {
      index--;
    },
    forward() {
      index++;
    },
  };
}

test("direct entry does not treat external browser history as an app back target", () => {
  const history = fakeHistory();
  installNavigationHistory(history);
  assert.equal(history.length, 2);
  assert.equal(canNavigateBack(history.state), false);
  assert.equal(history.state.__NA, true);
  assert.equal(history.state.tree, "initial");
});

test("push, back and forward retain the correct app depth", () => {
  const history = fakeHistory();
  installNavigationHistory(history);
  history.pushState({ __NA: true, tree: "notifications" });
  assert.equal(canNavigateBack(history.state), true);
  assert.equal(history.length, 3);
  history.back();
  assert.equal(canNavigateBack(history.state), false);
  history.forward();
  assert.equal(canNavigateBack(history.state), true);
});

test("replace preserves depth and router state without adding history", () => {
  const history = fakeHistory();
  installNavigationHistory(history);
  history.pushState({ tree: "second" });
  history.replaceState({ __NA: true, tree: "replacement" });
  assert.equal(history.length, 3);
  assert.equal(history.state.tree, "replacement");
  assert.equal(canNavigateBack(history.state), true);
});

test("installation is idempotent and navigation after back discards the old forward branch", () => {
  const history = fakeHistory();
  installNavigationHistory(history);
  installNavigationHistory(history);
  history.pushState({ tree: "second" });
  history.back();
  history.pushState({ tree: "different" });
  history.back();
  assert.equal(canNavigateBack(history.state), false);
  assert.equal(history.length, 3);
});

test("missing or invalid metadata cannot authorize back", () => {
  for (const state of [
    null,
    {},
    { __speakaiNavigation: { depth: -1 } },
    { __speakaiNavigation: { depth: "2" } },
  ]) {
    assert.equal(canNavigateBack(state), false);
  }
});

test("entry IDs survive replace/back and do not leak state to a new visit", () => {
  const history = fakeHistory();
  installNavigationHistory(history);
  const first = navigationEntryId(history.state);
  assert.ok(first);
  history.pushState({ tree: "notifications" });
  const notificationEntry = navigationEntryId(history.state);
  assert.notEqual(notificationEntry, first);
  history.replaceState({ tree: "notifications-updated" });
  assert.equal(navigationEntryId(history.state), notificationEntry);
  history.pushState({ tree: "practice" });
  history.back();
  assert.equal(navigationEntryId(history.state), notificationEntry);
  history.back();
  history.pushState({ tree: "notifications" });
  assert.notEqual(navigationEntryId(history.state), notificationEntry);
});
