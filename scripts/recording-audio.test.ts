import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { encodeMonoWav } from "../src/lib/recording-audio";

function processor(sampleRate: number) {
  const messages: Array<{ type: string; samples?: Float32Array }> = [];
  type ProcessorInstance = {
    port: { onmessage: (event: { data: string }) => void };
    process: (inputs: Float32Array[][]) => boolean;
  };
  let Processor!: new () => ProcessorInstance;
  runInNewContext(
    readFileSync(
      new URL("../public/audio/recording-processor.js", import.meta.url),
      "utf8",
    ),
    {
      sampleRate,
      Float32Array,
      AudioWorkletProcessor: class {
        port = {
          onmessage: null,
          postMessage: (data: (typeof messages)[number]) => messages.push(data),
        };
      },
      registerProcessor: (
        _name: string,
        implementation: new () => ProcessorInstance,
      ) => {
        Processor = implementation;
      },
    },
  );
  return { instance: new Processor(), messages };
}

for (const seconds of [7, 9]) {
  for (const sampleRate of [44100, 48000]) {
    test(`${seconds}s native recording at ${sampleRate}Hz preserves samples and WAV duration`, async () => {
      const { instance, messages } = processor(sampleRate);
      // Audio arriving before the start cue completes must not be recorded.
      instance.process([[new Float32Array(128).fill(0.9)]]);
      instance.port.onmessage({ data: "start" });
      const count = seconds * sampleRate;
      for (let offset = 0; offset < count; offset += 128) {
        const size = Math.min(128, count - offset);
        instance.process([
          [
            new Float32Array(size).fill(0.5),
            new Float32Array(size).fill(-0.25),
          ],
        ]);
      }
      instance.port.onmessage({ data: "stop" });
      assert.equal(messages.at(-1)?.type, "stopped");
      const result = encodeMonoWav(
        messages.flatMap((m) => (m.samples ? [m.samples] : [])),
        sampleRate,
      );
      assert.equal(result.durationMs, seconds * 1000);
      assert.equal(result.blob.size, 44 + count * 2);
      const view = new DataView(await result.blob.arrayBuffer());
      assert.equal(view.getUint32(24, true), sampleRate);
      assert.equal(
        view.getUint32(40, true) / view.getUint32(28, true),
        seconds,
      );
      assert.equal(view.getInt16(44, true), 4095);
      assert.equal(
        view.getInt16(view.byteLength - 2, true),
        4095,
        "final partial buffer must be flushed",
      );
      assert.equal(instance.process([[new Float32Array(128)]]), false);
    });
  }
}

test("empty capture is an error rather than a successful zero-second recording", () => {
  assert.throws(() => encodeMonoWav([], 48000), /녹음된 음성이 없습니다/);
});

test("PCM capture remains bounded when the app's stop timer is suspended", () => {
  const { instance, messages } = processor(100);
  instance.port.onmessage({ data: "start" });
  instance.process([[new Float32Array(7000)]]);
  instance.port.onmessage({ data: "stop" });
  const result = encodeMonoWav(
    messages.flatMap((m) => (m.samples ? [m.samples] : [])),
    100,
  );
  assert.equal(result.durationMs, 60_000);
});
