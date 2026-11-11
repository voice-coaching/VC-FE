"use client";

import { useEffect, useRef } from "react";
import styles from "./recording-waveform.module.css";

const BAR_COUNT = 24;
const HALF = BAR_COUNT / 2;
const REST_HEIGHT = 4;
const MAX_HEIGHT = 46;
/** Two cascaded one-pole filters: no spring, no overshoot, no frame-to-frame jitter. */
const ATTACK_MS = 110;
const RELEASE_MS = 340;
/** Inputs below this are treated as silence, so breath and room hiss stay flat. */
const GATE = 0.12;
/** Fade between live and paused/resting. */
const GAIN_MS = 260;

type Level = (now: number, dt: number) => number;

/** Voice-like envelope for UI previews: syllables inside phrases, with breaths between. */
function simulatedLevel(): Level {
  let phraseEnds = 0;
  let restEnds = 0;
  return (now) => {
    if (now > restEnds && now > phraseEnds) {
      phraseEnds = now + 1400 + Math.random() * 1800;
      restEnds = phraseEnds + 260 + Math.random() * 520;
    }
    if (now > phraseEnds) return 0;
    // ~4 syllables per second riding a slow sentence contour.
    const syllable = Math.pow(Math.sin(now / 125), 2);
    const contour = 0.65 + 0.35 * Math.sin(now / 1100);
    return contour * (0.35 + 0.65 * syllable);
  };
}

export function RecordingWaveform({
  stream,
  paused,
  simulate = false,
}: {
  stream: MediaStream | null;
  paused: boolean;
  /** Drive the bars from a synthetic voice instead of the microphone. */
  simulate?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  // Survives pause/resume so the waveform continues instead of restarting.
  const state = useRef({
    rough: 0,
    level: 0,
    gain: 0,
    drift: 0,
  });

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const bars = Array.from(element.children) as HTMLSpanElement[];
    const memory = state.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let frame = 0;
    let disposed = false;
    let previous = 0;
    let read: Level = () => 0;

    const live =
      !paused &&
      (simulate ||
        (!!stream &&
          stream
            .getAudioTracks()
            .some((track) => track.readyState === "live")));
    element.dataset.paused = String(!live);

    if (live && simulate) read = simulatedLevel();
    else if (live && stream) {
      try {
        context = new AudioContext();
        source = context.createMediaStreamSource(stream);
        const highpass = context.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 90;
        const lowpass = context.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 4000;
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0;
        // Read the recorder's existing stream only; never connect the microphone to speakers.
        source.connect(highpass).connect(lowpass).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        let noiseFloor = 0.0004;
        let peak = 0.02;
        read = (_now, dt) => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += sample * sample;
          const rms = Math.sqrt(sum / samples.length);
          const audible = stream
            .getAudioTracks()
            .some((t) => t.readyState === "live" && t.enabled && !t.muted);
          if (!audible) return 0;
          // Learn room noise only from quiet frames so speech never raises the gate.
          if (rms < noiseFloor * 2.5)
            noiseFloor += (rms - noiseFloor) * (1 - Math.exp(-dt / 1500));
          peak = Math.max(rms, peak * Math.exp(-dt / 3000), 0.01);
          // Perceptual (log-like) mapping: soft speech is visible, shouting doesn't clip early.
          const above = Math.max(0, rms - noiseFloor * 1.6);
          return Math.min(1, Math.pow(above / peak, 0.6));
        };
        void context.resume().catch(() => {
          read = () => 0;
        });
      } catch {
        read = () => 0;
      }
    }

    const tick = (now: number) => {
      if (disposed) return;
      const dt = previous ? Math.min(50, now - previous) : 16;
      previous = now;

      const raw = live ? read(now, dt) : 0;
      const input = Math.max(0, (raw - GATE) / (1 - GATE));
      const time = input > memory.rough ? ATTACK_MS : RELEASE_MS;
      memory.rough += (input - memory.rough) * (1 - Math.exp(-dt / time));
      memory.level +=
        (memory.rough - memory.level) * (1 - Math.exp(-dt / (time * 0.6)));
      memory.gain +=
        ((live ? 1 : 0) - memory.gain) * (1 - Math.exp(-dt / GAIN_MS));

      // The shape drifts slowly only while speaking, so it reads as alive, not noisy.
      const still = reducedMotion.matches;
      if (!still) memory.drift += dt * 0.0016 * memory.level;

      bars.forEach((bar, index) => {
        const distance = index < HALF ? HALF - 1 - index : index - HALF;
        // Symmetric profile: tall centre, calm edges, softly undulating.
        const taper = 1 - 0.6 * Math.pow(distance / HALF, 1.4);
        const ripple = still
          ? 1
          : 0.74 + 0.26 * Math.sin(memory.drift * 2.2 - distance * 0.62);
        const amount = Math.min(1, memory.level * taper * ripple) * memory.gain;
        const height = REST_HEIGHT + (MAX_HEIGHT - REST_HEIGHT) * amount;
        bar.style.height = `${height.toFixed(2)}px`;
        // Quiet bars recede into a softer tint rather than flipping colour.
        bar.style.opacity = (
          1 -
          0.6 * memory.gain * (1 - Math.min(1, amount * 2.2))
        ).toFixed(3);
      });

      if (!live && memory.gain < 0.002) {
        memory.gain = 0;
        memory.level = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      source?.disconnect();
      if (context && context.state !== "closed")
        void context.close().catch(() => {});
      // The recorder owns the tracks and stops them when recording finishes.
    };
  }, [stream, paused, simulate]);

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-paused="true"
      className={styles.waveform}
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span key={index} className={styles.bar} />
      ))}
    </div>
  );
}
