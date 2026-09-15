"use client";

import { useEffect, useRef } from "react";

const BAR_COUNT = 20;

export function RecordingWaveform({
  getStream,
}: {
  getStream: () => MediaStream | null;
}) {
  const bars = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let analyser: AnalyserNode | undefined;
    let frame = 0;
    let previous = 0;
    const heights = Array<number>(BAR_COUNT).fill(6);
    const frequencies = new Uint8Array(128);
    {
      const stream = getStream();
      if (stream) {
        try {
          context = new AudioContext();
          analyser = context.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.65;
          source = context.createMediaStreamSource(stream);
          source.connect(analyser);
          // Never connect the microphone to speakers (avoids feedback).
          void context.resume().catch(() => undefined);
        } catch {
          // Visual metering failure must not interrupt the recording.
          analyser = undefined;
        }
      }
    }

    const draw = (time: number) => {
      frame = window.requestAnimationFrame(draw);
      if (time - previous < (reducedMotion.matches ? 200 : 33)) return;
      previous = time;
      analyser?.getByteFrequencyData(frequencies);
      for (let index = 0; index < BAR_COUNT; index += 1) {
        const bin = 1 + Math.floor(index * 2.5);
        const level = analyser
          ? Math.max(0, (frequencies[bin] / 255 - 0.08) / 0.92)
          : 0;
        const target = 6 + Math.min(1, level * 1.6) * 46;
        heights[index] += (target - heights[index]) * 0.35;
        const bar = bars.current[index];
        if (bar) bar.style.transform = `scaleY(${heights[index] / 52})`;
      }
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      source?.disconnect();
      analyser?.disconnect();
      if (context && context.state !== "closed")
        void context.close().catch(() => undefined);
      // Stream belongs to the recorder; do not stop its tracks here.
    };
  }, [getStream]);

  return (
    <div
      className="flex h-14 w-full max-w-[300px] items-center justify-center gap-1"
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span
          key={index}
          ref={(element) => {
            bars.current[index] = element;
          }}
          className="h-[52px] w-1 origin-center rounded-[2px] bg-[#2f6bff]"
          style={{ transform: "scaleY(0.115)" }}
        />
      ))}
    </div>
  );
}
