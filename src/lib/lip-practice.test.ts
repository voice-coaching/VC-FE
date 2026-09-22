import assert from "node:assert/strict";
import test from "node:test";
import { preferredVideoMimeType, releaseLipResources } from "./lip-practice";

test("video mime selection uses the first supported format", () => {
  assert.equal(
    preferredVideoMimeType((mime) => mime === "video/webm"),
    "video/webm",
  );
  assert.equal(
    preferredVideoMimeType(() => false),
    undefined,
  );
});

test("lip resources stop every track and revoke every object URL", () => {
  let stopped = 0;
  const stream = {
    getTracks: () => [
      { stop: () => (stopped += 1) },
      { stop: () => (stopped += 1) },
    ],
  } as unknown as MediaStream;
  const revoked: string[] = [];
  releaseLipResources(
    stream,
    [{ url: "blob:first" }, { url: "blob:second" }],
    (url) => revoked.push(url),
  );
  assert.equal(stopped, 2);
  assert.deepEqual(revoked, ["blob:first", "blob:second"]);
});
