import assert from "node:assert/strict";
import test from "node:test";
import {
  HOME_HEADER_HEIGHT as H,
  settleHomeHeader,
  updateHomeHeader,
  type HeaderScrollState,
} from "../src/lib/home-header-scroll";

const initial: HeaderScrollState = { top: 0, offset: 0 };

test("near the top the header scrolls away 1:1 with the content", () => {
  assert.equal(updateHomeHeader(initial, 60, 1000).offset, 60);
  assert.equal(updateHomeHeader(initial, 400, 1000).offset, H);
});

test("scrolling up reveals the header only as far as the finger moves", () => {
  const hidden = updateHomeHeader(initial, 600, 1000);
  const peek = updateHomeHeader(hidden, 560, 1000);
  assert.equal(peek.offset, H - 40);
  assert.equal(updateHomeHeader(peek, 600, 1000).offset, H);
});

test("a half-revealed header settles to the nearer edge", () => {
  const hidden = updateHomeHeader(initial, 600, 1000);
  assert.equal(settleHomeHeader(updateHomeHeader(hidden, 560, 1000)), H);
  assert.equal(settleHomeHeader(updateHomeHeader(hidden, 450, 1000)), 0);
  // While attached near the top there is nothing to settle.
  assert.equal(settleHomeHeader(updateHomeHeader(initial, 90, 1000)), 90);
});

test("top and short pages always show the header", () => {
  const hidden = updateHomeHeader(initial, 400, 1000);
  assert.equal(updateHomeHeader(hidden, -30, 1000).offset, 0);
  assert.equal(updateHomeHeader(initial, 80, 0).offset, 0);
});

test("bottom bounce does not reveal a hidden header", () => {
  let state = updateHomeHeader(initial, 1000, 1000);
  state = updateHomeHeader(state, 1040, 1000);
  state = updateHomeHeader(state, 1000, 1000);
  assert.equal(state.offset, H);
});
