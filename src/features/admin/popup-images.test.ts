import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { uploadPopupImage, removePopupImage } from "./popup-images";
import type { Popup } from "./types";

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});
const current: Popup = {
  id: 10,
  version: 2,
  title: "안내",
  body: "본문",
  deepLink: null,
  priority: 1,
  startsAt: "2026-11-10T00:00:00Z",
  endsAt: "2026-12-01T00:00:00Z",
  enabled: true,
  createdAt: "2026-11-10T00:00:00Z",
};
const image = {
  id: "00000000-0000-4000-8000-000000000001",
  url: "https://images.example.invalid/p.png",
  expiresAt: current.endsAt,
};
const reply = (data: unknown) => Response.json({ result: true, data });
test("image upload preserves file and version in multipart, never sets a manual boundary", async () => {
  const file = new File(["png fixture"], "image.png", { type: "image/png" });
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "/api/backend/api/admin/popups/10/image");
    assert.equal(options?.method, "POST");
    assert.equal(new Headers(options?.headers).has("content-type"), false);
    const form = options?.body as FormData;
    assert.equal(form.get("version"), "2");
    assert.equal(form.get("reason"), "attach");
    assert.equal((form.get("file") as File).size, file.size);
    return reply({ ...current, version: 3, image });
  };
  assert.equal(
    (await uploadPopupImage(current, file, "attach")).image?.id,
    image.id,
  );
});
test("unsupported and oversized images fail before a request", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return reply({});
  };
  for (const file of [
    new File(["svg"], "x.svg", { type: "image/svg+xml" }),
    new File([new Uint8Array(3 * 1024 * 1024 + 1)], "x.png", {
      type: "image/png",
    }),
  ])
    await assert.rejects(uploadPopupImage(current, file, "첨부"));
  assert.equal(calls, 0);
});
test("detach requires an advanced version and null image, and conflict never retries", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return reply({ ...current, version: 3, image: null });
  };
  assert.equal((await removePopupImage(current, "해제")).image, null);
  globalThis.fetch = async () => {
    calls++;
    return Response.json(
      { result: false, code: "ADMIN_EDIT_CONFLICT", message: "conflict" },
      { status: 409 },
    );
  };
  await assert.rejects(removePopupImage(current, "해제"));
  assert.equal(calls, 2);
  globalThis.fetch = async () => reply({ ...current, version: 3, image });
  await assert.rejects(removePopupImage(current, "해제"));
});
