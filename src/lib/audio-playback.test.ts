import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlaybackCoordinator,
  remainingAudioDuration,
  resolveAudioDuration,
} from "./audio-playback";

test("pending audio loads claim exclusive playback until pause, failure or unmount", () => {
  const playback = createPlaybackCoordinator();
  const recording = Symbol("recording");
  const guide = Symbol("guide");
  let notifications = 0;
  const unsubscribe = playback.subscribe(() => notifications++);
  assert.equal(playback.claim(recording), true);
  assert.equal(playback.claim(guide), false);
  playback.release(guide);
  assert.equal(playback.getSnapshot(), recording);
  playback.release(recording);
  assert.equal(playback.getSnapshot(), null);
  assert.equal(playback.claim(guide), true);
  // Late cleanup from the previous player cannot unlock the new player.
  playback.release(recording);
  assert.equal(playback.getSnapshot(), guide);
  playback.release(guide);
  assert.equal(notifications, 4);
  unsubscribe();
  playback.claim(recording);
  assert.equal(notifications, 4);
});

test("zero or incomplete media metadata keeps the recorded duration", () => {
  assert.equal(resolveAudioDuration(0, 6), 6);
  assert.equal(resolveAudioDuration(Number.POSITIVE_INFINITY, 6), 6);
  assert.equal(resolveAudioDuration(Number.NaN, 6), 6);
});

test("positive media metadata replaces the fallback duration", () => {
  assert.equal(resolveAudioDuration(6.24, 6), 6.24);
});

test("implausibly short embedded metadata does not replace the recording clock", () => {
  assert.equal(resolveAudioDuration(0.04, 7), 7);
  assert.equal(resolveAudioDuration(3, 7), 3);
});

test("remaining playback time starts at the full duration and clamps at zero", () => {
  assert.equal(remainingAudioDuration(6, 0), 6);
  assert.equal(remainingAudioDuration(6, 1.5), 4.5);
  assert.equal(remainingAudioDuration(6, 8), 0);
});
