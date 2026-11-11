import assert from "node:assert/strict";
import test from "node:test";
import { notificationHref } from "../src/lib/notification-link";

test("existing API and cached notification aliases open the real inbox", () => {
  assert.equal(notificationHref("/notifications"), "/home/notifications");
  assert.equal(
    notificationHref("/notifications/?page=2#recent"),
    "/home/notifications?page=2#recent",
  );
  for (const link of [
    "/home",
    "/mypage",
    "/home/notifications",
    "/mypage/history/319?tab=report",
  ])
    assert.equal(notificationHref(link), link);
});
test("missing or external notification links never produce an external anchor", () => {
  for (const link of [
    null,
    undefined,
    "",
    "https://example.invalid",
    "//example.invalid",
    "/\\example.invalid",
    "/\n/example.invalid",
    "javascript:alert(1)",
  ])
    assert.equal(notificationHref(link), undefined);
});
