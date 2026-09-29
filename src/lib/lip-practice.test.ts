import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareVideoForAnalysis,
  preferredVideoMimeType,
  releaseLipResources,
} from "./lip-practice";

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

test("video preparation normalizes codecs and keeps an accepted MP4", () => {
  const source = new Blob(["video"], { type: "video/mp4;codecs=h264,aac" });
  const prepared = prepareVideoForAnalysis(source, ["video/mp4"]);

  assert.equal(prepared.mimeType, "video/mp4");
  assert.equal(prepared.extension, "mp4");
  assert.equal(prepared.blob.size, source.size);
});

test("video preparation rejects a format the server does not accept", () => {
  const source = new Blob(["video"], { type: "video/webm" });

  assert.throws(
    () => prepareVideoForAnalysis(source, ["video/mp4"]),
    /서버가 지원하지 않습니다/,
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
