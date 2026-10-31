import assert from "node:assert/strict";
import test from "node:test";
import { createSpeechGuide } from "./speech-guide";
import { referencePlayback } from "./audio-playback";

function device() {
  const spoken: SpeechSynthesisUtterance[] = [];
  let cancels = 0;
  const synthesis = {
    paused: false,
    getVoices: () => [],
    speak: (value: SpeechSynthesisUtterance) => {
      spoken.push(value);
    },
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    },
    cancel() {
      cancels += 1;
    },
  };
  const states: Array<boolean | string> = [];
  const guide = (text: string) =>
    createSpeechGuide(
      text,
      synthesis as unknown as SpeechSynthesis,
      (value) => ({ text: value }) as SpeechSynthesisUtterance,
      (playing, error) => states.push(error || playing),
    );
  const fire = (
    item: SpeechSynthesisUtterance,
    kind: "onstart" | "onend" | "onerror",
  ) => (item[kind] as (() => void) | null)?.();
  return { guide, spoken, fire, states, synthesis, cancels: () => cancels };
}

test("guide claims audio before TTS starts, pauses and resumes the same utterance", () => {
  const d = device();
  const guide = d.guide("내 문장입니다.");
  guide.toggle();
  assert.equal(referencePlayback.getSnapshot(), guide.id);
  assert.equal(d.spoken[0].lang, "ko-KR");
  d.fire(d.spoken[0], "onstart");
  guide.toggle();
  assert.equal(referencePlayback.getSnapshot(), null);
  assert.equal(d.synthesis.paused, true);
  guide.toggle();
  assert.equal(d.spoken.length, 1);
  assert.equal(referencePlayback.getSnapshot(), guide.id);
  d.fire(d.spoken[0], "onend");
  assert.equal(referencePlayback.getSnapshot(), null);
  guide.dispose();
});

test("recording playback blocks TTS and a second guide cannot overlap", () => {
  const d = device();
  const first = d.guide("Hello"),
    second = d.guide("World");
  const recording = Symbol("recording");
  referencePlayback.claim(recording);
  first.toggle();
  assert.equal(d.spoken.length, 0);
  referencePlayback.release(recording);
  first.toggle();
  second.toggle();
  assert.equal(d.spoken.length, 1);
  d.fire(d.spoken[0], "onstart");
  first.toggle();
  second.toggle();
  assert.equal(d.spoken.length, 2);
  assert.equal(d.spoken[1].lang, "en-US");
  assert.equal(referencePlayback.getSnapshot(), second.id);
  // A delayed completion from the cancelled guide must not release the new one.
  d.fire(d.spoken[0], "onend");
  assert.equal(referencePlayback.getSnapshot(), second.id);
  first.dispose();
  second.dispose();
  assert.equal(referencePlayback.getSnapshot(), null);
});

test("TTS failure and unmount release the lock and ignore late callbacks", () => {
  const d = device();
  const guide = d.guide("테스트");
  guide.toggle();
  d.fire(d.spoken[0], "onerror");
  assert.match(String(d.states.at(-1)), /재생하지 못했/);
  assert.equal(referencePlayback.getSnapshot(), null);
  guide.toggle();
  guide.dispose();
  const changes = d.states.length;
  d.fire(d.spoken[1], "onstart");
  assert.equal(d.states.length, changes);
  assert.equal(referencePlayback.getSnapshot(), null);
});
