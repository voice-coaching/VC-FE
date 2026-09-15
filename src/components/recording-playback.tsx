"use client";

import Image from "next/image";
import { Pause } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const COUNT = 28;
const formatTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

export function RecordingPlayback({
  source,
  durationSeconds,
  title,
}: {
  source?: string;
  durationSeconds: number;
  title: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const position = useRef(0);
  const [envelope, setEnvelope] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>(Array(COUNT).fill(0));
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    let context: AudioContext | undefined;
    setPlaying(false);
    setElapsed(0);
    position.current = 0;
    setDuration(durationSeconds);
    setError(null);
    setEnvelope([]);
    setPeaks(Array(COUNT).fill(0));
    if (source) {
      void (async () => {
        try {
          const response = await fetch(source, { signal: abort.signal });
          if (!response.ok) throw new Error("audio fetch failed");
          const bytes = await response.arrayBuffer();
          if (!active) return;
          context = new AudioContext();
          const buffer = await context.decodeAudioData(bytes);
          if (!active) return;
          const samples = buffer.getChannelData(0);
          const windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.03));
          const rms: number[] = [];
          for (let start = 0; start < samples.length; start += windowSize) {
            const end = Math.min(samples.length, start + windowSize);
            let sum = 0;
            for (let index = start; index < end; index += 1)
              sum += samples[index] ** 2;
            rms.push(Math.sqrt(sum / (end - start)));
          }
          const maximum = Math.max(0.01, ...rms);
          const normalized = rms.map((value) => Math.min(1, value / maximum));
          setEnvelope(normalized);
          setPeaks(
            Array.from({ length: COUNT }, (_, index) => {
              const from = Math.floor((index * normalized.length) / COUNT);
              const to = Math.max(
                from + 1,
                Math.floor(((index + 1) * normalized.length) / COUNT),
              );
              return Math.max(0, ...normalized.slice(from, to));
            }),
          );
          setDuration(buffer.duration);
        } catch {
          if (active)
            setError(
              "파형을 불러오지 못했습니다. 음성 재생은 다시 시도할 수 있습니다.",
            );
        } finally {
          if (context && context.state !== "closed")
            void context.close().catch(() => undefined);
        }
      })();
    }
    return () => {
      active = false;
      abort.abort();
      if (context && context.state !== "closed")
        void context.close().catch(() => undefined);
    };
  }, [source, durationSeconds]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const next = audio.current?.currentTime ?? 0;
      position.current = next;
      setElapsed(next);
    }, 33);
    return () => window.clearInterval(timer);
  }, [playing]);

  function seek(value: number) {
    const next = Math.min(duration, Math.max(0, value));
    position.current = next;
    setElapsed(next);
    if (audio.current) {
      try {
        audio.current.currentTime = next;
      } catch {
        setError("음성이 로드된 후 다시 위치를 선택해 주세요.");
      }
    }
  }

  async function toggle() {
    if (playing) {
      audio.current?.pause();
      setPlaying(false);
      return;
    }
    if (elapsed >= duration) seek(0);
    try {
      await audio.current?.play();
    } catch {
      setError("음성을 재생하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const current = Math.min(COUNT - 1, Math.floor(progress * COUNT));
  const energy =
    envelope[
      Math.min(envelope.length - 1, Math.floor(progress * envelope.length))
    ] ?? 0;
  return (
    <section className="space-y-3 rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] leading-[22px] font-bold tracking-[0.144px]">
          {title}
        </h2>
      </div>
      {source && (
        <audio
          ref={audio}
          src={source}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            position.current = duration;
            setElapsed(duration);
          }}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setDuration(value);
          }}
          onError={() => {
            setPlaying(false);
            setError("녹음 음성을 불러오지 못했습니다.");
          }}
        />
      )}
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={!source}
          aria-label={playing ? "내 녹음 일시정지" : "내 녹음 재생"}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#2f6bff] text-white"
        >
          {playing ? (
            <Pause className="size-5" fill="currentColor" />
          ) : (
            <Image
              src="/figma/auth/script-review-play.svg"
              alt=""
              width={20}
              height={20}
            />
          )}
        </button>
        <div className="relative min-w-0 flex-1 rounded-md focus-within:ring-2 focus-within:ring-[#2f6bff] focus-within:ring-offset-2">
          <div
            aria-hidden="true"
            className="flex h-12 items-center justify-between gap-px"
          >
            {peaks.map((peak, index) => {
              const nearby = Math.abs(index - current) <= 2;
              const height =
                playing && nearby && !reducedMotion
                  ? 6 + 40 * (0.35 * peak + 0.65 * energy)
                  : 6 + 40 * peak;
              return (
                <span
                  key={index}
                  className={`w-1 min-w-0 rounded-[2px] ${index <= current && elapsed > 0 ? "bg-[#2f6bff]" : "bg-[#c3c8d0]"}`}
                  style={{ height }}
                />
              );
            })}
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 h-12 w-0.5 rounded-full bg-[#2f6bff]"
            style={{ left: `calc(${progress * 100}% - ${progress * 2}px)` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={Math.min(elapsed, duration)}
            disabled={duration <= 0 || !source}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="내 녹음 재생 위치"
            aria-valuetext={`${formatTime(elapsed)} / ${formatTime(duration)}`}
            className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <span className="shrink-0 text-right text-[11px] leading-4 text-[#8b95a1] tabular-nums">
          {formatTime(elapsed)}
          <br />/ {formatTime(duration)}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
