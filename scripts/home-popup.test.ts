import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { loadActiveHomePopup } from "../src/lib/home-popup";
import { saveAccessToken, clearAccessToken } from "../src/lib/api/client";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});
const popup = {
  id: 1,
  title: "서비스 안내",
  body: "안내 문구입니다.\n다음 줄입니다.",
  deepLink: "/notifications",
  startsAt: "2026-11-01T00:00:00Z",
  endsAt: "2026-11-30T00:00:00Z",
};
const reply = (data: unknown) => Response.json({ result: true, data });

test("home popup uses an authenticated no-store GET and maps the backend notification destination", async () => {
  saveAccessToken("popup-fixture");
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "/api/backend/api/users/me/popup");
    assert.equal(options?.method, "GET");
    assert.equal(options?.cache, "no-store");
    assert.equal(
      new Headers(options?.headers).get("authorization"),
      "Bearer popup-fixture",
    );
    return reply(popup);
  };
  assert.deepEqual(await loadActiveHomePopup(), {
    id: 1,
    title: popup.title,
    body: popup.body,
    href: "/home/notifications",
  });
});
test("no active popup stays null and no-link popups remain closable", async () => {
  globalThis.fetch = async () => reply(null);
  assert.equal(await loadActiveHomePopup(), null);
  globalThis.fetch = async () => reply({ ...popup, deepLink: null });
  assert.equal((await loadActiveHomePopup())?.href, null);
});
test("unsafe destinations and malformed popup payloads are rejected", async () => {
  for (const invalid of [
    { ...popup, deepLink: "https://example.invalid" },
    { ...popup, deepLink: "//example.invalid" },
    { ...popup, id: 0 },
    { ...popup, title: " " },
    { ...popup, endsAt: "invalid" },
    { ...popup, endsAt: popup.startsAt },
  ]) {
    globalThis.fetch = async () => reply(invalid);
    await assert.rejects(loadActiveHomePopup());
  }
});
test("server-selected popup does not depend on the device calendar", async () => {
  globalThis.fetch = async () =>
    reply({
      ...popup,
      startsAt: "2000-01-01T00:00:00Z",
      endsAt: "2000-01-02T00:00:00Z",
    });
  assert.equal((await loadActiveHomePopup())?.id, 1);
});
test("popup fetch errors are surfaced to the optional UI boundary without submitting anything", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options?.method, "GET");
    return Response.json(
      { result: false, code: "UNAVAILABLE" },
      { status: 503 },
    );
  };
  await assert.rejects(loadActiveHomePopup());
});
