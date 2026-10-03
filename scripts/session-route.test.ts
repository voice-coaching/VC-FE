import assert from "node:assert/strict";
import test from "node:test";
import { sessionRouteRedirect } from "../src/lib/session-route";

test("completed users cannot reopen consent or onboarding", () => {
  for (const accepted of [false, true]) {
    for (const path of ["/terms", "/onboarding"]) {
      assert.equal(sessionRouteRedirect(path, true, accepted), "/home");
    }
    for (const path of ["/home", "/terms/complete", "/mypage"]) {
      assert.equal(sessionRouteRedirect(path, true, accepted), null);
    }
  }
});

test("incomplete users must consent before entering onboarding or protected pages", () => {
  assert.equal(sessionRouteRedirect("/terms", false, false), null);
  for (const path of ["/onboarding", "/home", "/terms/complete", "/class"]) {
    assert.equal(sessionRouteRedirect(path, false, false), "/terms");
  }
});

test("accepted users can review terms without a redirect loop", () => {
  for (const path of ["/terms", "/onboarding"]) {
    assert.equal(sessionRouteRedirect(path, false, true), null);
  }
  for (const path of ["/home", "/terms/complete", "/class"]) {
    assert.equal(sessionRouteRedirect(path, false, true), "/onboarding");
  }
});
