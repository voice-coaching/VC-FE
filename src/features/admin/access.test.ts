import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { adminApi, clearAdminDenial, subscribeAdminDenial } from "./api";
import { clearAccessToken, saveAccessToken } from "@/lib/api/client";
const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
  clearAccessToken();
  clearAdminDenial();
});
const denied = () =>
  Response.json(
    { result: false, code: "ACCESS_DENIED", message: "denied" },
    { status: 403 },
  );
test("denial survives query observer replacement; only manual recheck or a new session sends again", async () => {
  clearAdminDenial();
  saveAccessToken("opaque-fixture");
  let calls = 0,
    events = 0;
  const stop = subscribeAdminDenial(() => events++);
  globalThis.fetch = async () => {
    calls++;
    return denied();
  };
  try {
    await assert.rejects(adminApi.access());
    await assert.rejects(adminApi.access());
    assert.equal(calls, 1);
    assert.equal(events, 1);
    clearAdminDenial();
    await assert.rejects(adminApi.access());
    assert.equal(calls, 2);
    saveAccessToken("new-login");
    await assert.rejects(adminApi.access());
    assert.equal(calls, 3);
  } finally {
    stop();
  }
});
test("a late approved response cannot restore access after another administrator API denies it", async () => {
  clearAdminDenial();
  saveAccessToken("late-fixture");
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>((done) => {
    resolve = done;
  });
  globalThis.fetch = async (url) =>
    String(url).endsWith("/me") ? pending : denied();
  const approval = adminApi.access();
  await assert.rejects(adminApi.read("/users"));
  resolve(
    Response.json({
      result: true,
      data: { id: 1, nickname: "admin", role: "ADMIN" },
    }),
  );
  await assert.rejects(approval);
  await assert.rejects(adminApi.access());
});
