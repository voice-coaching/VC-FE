"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat2, Volume2 } from "lucide-react";
import { api, type Id } from "@/lib/api";

export function ReferencePlayer({
  contentId,
  title = "기준 발음 듣기",
  source,
  durationSeconds,
  compact = false,
}: {
  contentId?: Id;
  title?: string;
  source?: string;
  durationSeconds?: number;
  compact?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState(source);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const fallbackDuration =
    durationSeconds && Number.isFinite(durationSeconds) ? durationSeconds : 0;
  const [duration, setDuration] = useState(fallbackDuration);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(source);
    setPlaying(false);
    setElapsed(0);
    setDuration(fallbackDuration);
    setError(null);
  }, [contentId, fallbackDuration, source]);
  async function toggle() {
    if (!audio.current) return;
    if (playing) {
      audio.current.pause();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let nextUrl = url;
      if (!nextUrl && contentId != null) {
        const items = await api.content.getReferenceAudios(contentId);
        const selected = items.find((item) => item.primary) ?? items[0];
        if (!selected) throw new Error("등록된 기준 음성이 없습니다.");
        nextUrl = (await api.content.getReferenceAudioPlaybackUrl(selected.id))
          .playbackUrl;
        setUrl(nextUrl);
      }
      if (!nextUrl) throw new Error("재생할 음성이 없습니다.");
      if (audio.current.src !== nextUrl) audio.current.src = nextUrl;
      await audio.current.play();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "음성을 재생하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }
  const time = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
  return (
    <section
      className={
        compact ? "rounded-full bg-white/20 p-1.5 text-white" : "design-card"
      }
    >
      <div
        className={compact ? "sr-only" : "flex items-center justify-between"}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">
          {time(playing ? elapsed : duration)}
        </span>
      </div>
      <audio
        ref={audio}
        src={url}
        loop={repeat}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : fallbackDuration,
          )
        }
        onError={() => {
          setPlaying(false);
          setUrl(undefined);
          setError("음성을 불러오지 못했습니다. 다시 재생해 주세요.");
        }}
      />
      {compact ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={playing ? "내 녹음 일시 정지" : "내 녹음 재생"}
            disabled={loading}
            onClick={() => void toggle()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#3468ff]"
          >
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" fill="currentColor" />
            )}
          </button>
          <div
            aria-hidden="true"
            className="flex flex-1 items-center justify-center gap-1"
          >
            {[12, 22, 30, 17, 25, 34, 16, 28, 22, 32, 18, 25, 14].map(
              (height, index) => (
                <span
                  key={index}
                  className="w-[3px] rounded-full bg-white/55"
                  style={{ height }}
                />
              ),
            )}
          </div>
          <span className="pr-3 text-xs">
            {time(playing ? elapsed : duration)}
          </span>
        </div>
      ) : (
        <>
          <div
            className="my-5 flex h-10 items-center justify-center gap-1"
            aria-hidden="true"
          >
            {[
              12, 22, 35, 25, 18, 31, 42, 23, 15, 30, 37, 24, 16, 29, 19, 11,
              24, 32, 20, 14, 25,
            ].map((height, index) => (
              <span
                key={index}
                className={`w-1 rounded-full ${playing && index / 21 < elapsed / (duration || 1) ? "bg-primary" : "bg-border"}`}
                style={{ height }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void toggle()}
              className="design-action !min-h-12 !rounded-xl !text-sm"
            >
              {playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" fill="currentColor" />
              )}
              {loading ? "불러오는 중…" : playing ? "일시 정지" : "재생"}
            </button>
            <button
              type="button"
              aria-pressed={repeat}
              onClick={() => setRepeat(!repeat)}
              className={`flex shrink-0 items-center gap-1 rounded-xl border px-3 text-xs ${repeat ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
            >
              <Repeat2 className="size-4" />
              반복
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 flex gap-1 text-xs text-destructive">
          <Volume2 className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </section>
  );
}
