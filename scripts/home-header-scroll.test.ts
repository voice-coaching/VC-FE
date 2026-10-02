import assert from "node:assert/strict";
import test from "node:test";
import {
  updateHomeHeader,
  type HeaderScrollState,
} from "../src/lib/home-header-scroll";

const initial: HeaderScrollState = { top: 0, travel: 0, hidden: false };

test("hide on downward scroll and reveal on upward scroll without returning to the top", () => {
  const hidden = updateHomeHeader(initial, 400, 1000);
  assert.equal(hidden.hidden, true);
  assert.equal(updateHomeHeader(hidden, 380, 1000).hidden, false);
});

test("tiny direction changes do not flicker the header", () => {
  let state = updateHomeHeader(initial, 400, 1000);
  for (const top of [399, 400, 398, 400, 397]) {
    state = updateHomeHeader(state, top, 1000);
    assert.equal(state.hidden, true);
  }
  state = updateHomeHeader(state, 388, 1000);
  assert.equal(state.hidden, false);
});

test("top and short pages always show the header", () => {
  const hidden = updateHomeHeader(initial, 400, 1000);
  assert.equal(updateHomeHeader(hidden, -30, 1000).hidden, false);
  assert.equal(updateHomeHeader(initial, 80, 100).hidden, false);
  assert.equal(updateHomeHeader(initial, 100, 0).hidden, false);
});

test("bottom bounce does not reveal a hidden header", () => {
  let state = updateHomeHeader(initial, 1000, 1000);
  state = updateHomeHeader(state, 1040, 1000);
  state = updateHomeHeader(state, 1000, 1000);
  assert.equal(state.hidden, true);
  assert.equal(updateHomeHeader(state, 988, 1000).hidden, false);
});
