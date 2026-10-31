"use client";

import { useEffect, useRef } from "react";
import styles from "./recording-waveform.module.css";

const BAR_COUNT = 20;
const REST_HEIGHT = 6;

export function RecordingWaveform({
  stream,
  paused,
}: {
  stream: MediaStream | null;
  paused: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const bars = Array.from(element.children) as HTMLSpanElement[];
    function reset() {
      element!.dataset.active = "false";
      bars.forEach((bar) => {
        bar.style.height = `${REST_HEIGHT}px`;
      });
    }
    reset();
    if (
      paused ||
      !stream ||
      !stream.getAudioTracks().some((track) => track.readyState === "live")
    )
      return;
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let frame = 0;
    let disposed = false;
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
      analyser.smoothingTimeConstant = 0.35;
      source.connect(highpass).connect(lowpass).connect(analyser);
      // Read the recorder's existing stream only; never connect the microphone to speakers.
      const samples = new Float32Array(analyser.fftSize);
      const spectrum = new Float32Array(analyser.frequencyBinCount);
      let active = false;
      let lastSound = -Infinity;
      let previousFrame = 0;
      let peak = 0.015;
      let noiseFloor = 0.0003;
      let lastHistory = 0;
      const history = new Array<number>(BAR_COUNT).fill(0);
      const heights = new Array<number>(BAR_COUNT).fill(REST_HEIGHT);
      // Logarithmic bands give low-frequency vowels room alongside consonants.
      const bands = Array.from({ length: BAR_COUNT }, (_, index) => {
        const bin = (hz: number) =>
          Math.round((hz * analyser.fftSize) / context!.sampleRate);
        const low = Math.max(
          1,
          bin(90 * Math.pow(4000 / 90, index / BAR_COUNT)),
        );
        const high = Math.min(
          spectrum.length,
          Math.max(
            low + 1,
            bin(90 * Math.pow(4000 / 90, (index + 1) / BAR_COUNT)),
          ),
        );
        return { low, high };
      });
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      const tick = (now: number) => {
        if (disposed) return;
        frame = requestAnimationFrame(tick);
        const dt = previousFrame ? Math.min(50, now - previousFrame) : 16;
        previousFrame = now;
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, sample) => sum + sample * sample, 0) /
            samples.length,
        );
        const live = stream
          .getAudioTracks()
          .some(
            (track) =>
              track.readyState === "live" && track.enabled && !track.muted,
          );
        // Sensitive to quiet speech; learn only below the gate so speech cannot raise it.
        const threshold = Math.max(0.002, Math.min(0.006, noiseFloor * 3));
        if (!active && rms < threshold)
          noiseFloor += (rms - noiseFloor) * (1 - Math.exp(-dt / 1800));
        if (live && rms > threshold * (active ? 0.65 : 1)) lastSound = now;
        active = live && now - lastSound < 280;
        element.dataset.active = String(active);
        peak = Math.max(rms, peak * Math.exp(-dt / 2500), 0.008);
        const volume = live
          ? Math.min(1, Math.sqrt(Math.max(0, rms - noiseFloor) / peak))
          : 0;
        if (now - lastHistory >= 32) {
          history.shift();
          history.push(volume);
          lastHistory = now;
        }
        analyser.getFloatFrequencyData(spectrum);
        const energy = bands.map(({ low, high }) => {
          let power = 0;
          for (let bin = low; bin < high; bin++)
            power += Math.pow(10, spectrum[bin] / 10);
          return Math.sqrt(power / (high - low));
        });
        const strongest = Math.max(...energy, 0.00001);
        bars.forEach((bar, index) => {
          // Actual spectrum plus recent loudness, rather than a predetermined wave shape.
          const band = Math.sqrt(energy[index] / strongest);
          const signal = volume * (0.15 + band * 0.55) + history[index] * 0.3;
          const target = active
            ? REST_HEIGHT + 54 * Math.min(1, signal)
            : REST_HEIGHT;
          const time = target > heights[index] ? 45 : 160;
          heights[index] +=
            (target - heights[index]) * (1 - Math.exp(-dt / time));
          bar.style.height = `${reducedMotion.matches ? (active ? 28 : REST_HEIGHT) : heights[index].toFixed(2)}px`;
        });
      };
      void context
        .resume()
        .then(() => {
          if (!disposed) frame = requestAnimationFrame(tick);
        })
        .catch(reset);
    } catch {
      reset();
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      source?.disconnect();
      if (context && context.state !== "closed")
        void context.close().catch(() => {});
      reset();
      // The recorder owns the tracks and stops them when recording finishes.
    };
  }, [stream, paused]);

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-active="false"
      className={styles.waveform}
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span key={index} className={styles.bar} />
      ))}
    </div>
  );
}
