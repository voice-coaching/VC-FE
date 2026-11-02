import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import {
  adminReadPolicy,
  affectedAdminRead,
  installAdminCacheLifecycle,
} from "./cache";
import { adminApi } from "./api";
import {
  clearAccessToken,
  getAuthSessionVersion,
  saveAccessToken,
} from "@/lib/api/client";

test("read policy keeps access and editable/personal details fresh while reusing bounded list state", () => {
  for (const path of [
    "/me",
    "/users/13/overview",
    "/contents/60",
    "/notices/1",
    "/notification-campaigns/1",
    "/popups/1",
    "/inquiries/1",
    "/reference-audios/1/playback-url",
    "/unknown",
  ])
    assert.deepEqual(adminReadPolicy(path), { staleTime: 0, gcTime: 0 });
  assert.equal(adminReadPolicy("/users").staleTime, 10_000);
  assert.equal(adminReadPolicy("/contents").staleTime, 30_000);
  assert.equal(
    adminReadPolicy("/users/13/records", { resource: "ANALYSES" }).staleTime,
    5_000,
  );
  for (const resource of [
    "PAYMENTS",
    "CANCELLATIONS",
    "COACHING_USAGE",
    "MEMBERSHIP_GRANTS",
    "PROCESSING_CONSENTS",
    "FUTURE_UNKNOWN",
  ])
    assert.deepEqual(adminReadPolicy("/users/13/records", { resource }), {
      staleTime: 0,
      gcTime: 0,
    });
  assert.equal(adminReadPolicy("/content-categories").staleTime, 300_000);
  assert.ok(adminReadPolicy("/content-categories").gcTime < 1_000_000);
});
test("writes invalidate related reads, never admission or unrelated domains", () => {
  assert.equal(
    affectedAdminRead("/contents/60/reference-audios", [
      "/contents",
      "/audit-logs",
    ]),
    true,
  );
  assert.equal(
    affectedAdminRead("/audit-logs", ["/contents", "/audit-logs"]),
    true,
  );
  assert.equal(
    affectedAdminRead("/users", ["/contents", "/audit-logs"]),
    false,
  );
  assert.equal(affectedAdminRead("access", ["*"]), false);
  assert.equal(affectedAdminRead("/users", []), false);
  assert.equal(affectedAdminRead("/users", [""]), false);
  assert.equal(affectedAdminRead("/contents-other", ["/contents"]), false);
});
test("account changes erase admin state only and denial cancels all admin cached data", async () => {
  const query = new QueryClient();
  const original = globalThis.fetch;
  clearAccessToken();
  saveAccessToken("cache-test-account-one");
  const scope = getAuthSessionVersion();
  const stop = installAdminCacheLifecycle(query);
  try {
    query.setQueryData(["admin", scope, "/users", {}], {
      private: "old-account",
    });
    query.setQueryData(["ordinary-public-read"], "keep");
    saveAccessToken("cache-test-account-two");
    assert.equal(query.getQueryData(["admin", scope, "/users", {}]), undefined);
    assert.equal(query.getQueryData(["ordinary-public-read"]), "keep");
    const current = getAuthSessionVersion();
    query.setQueryData(["admin", current, "/contents", {}], "private");
    globalThis.fetch = async () =>
      Response.json(
        { result: false, message: "denied", data: null },
        { status: 403 },
      );
    await assert.rejects(adminApi.read("/users"));
    assert.equal(
      query.getQueryData(["admin", current, "/contents", {}]),
      undefined,
    );
    assert.equal(query.getQueryData(["ordinary-public-read"]), "keep");
  } finally {
    stop();
    globalThis.fetch = original;
    clearAccessToken();
    query.clear();
  }
});
