"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat2, Volume2 } from "lucide-react";
import { api, type Id, type ReferenceAudio } from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import { readUserClientCache, writeUserClientCache } from "@/lib/client-cache";

type ReferencePlayerProps = {
  contentId?: Id;
  recordingId?: Id;
  title?: string;
  source?: string;
  durationSeconds?: number;
  compact?: boolean;
  buttonTone?: "primary" | "neutral";
  variant?: "default" | "guide" | "recording";
  disabled?: boolean;
};

export function ReferencePlayer(props: ReferencePlayerProps) {
  return (
    <ReferencePlayerSession
      key={JSON.stringify([props.contentId, props.recordingId, props.source])}
      {...props}
    />
  );
}

function ReferencePlayerSession({
  contentId,
  recordingId,
  title = "기준 발음 듣기",
  source,
  durationSeconds,
  compact = false,
  buttonTone,
  variant = "default",
  disabled = false,
}: ReferencePlayerProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const sequence = useRef(0);
  const busy = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const fallbackDuration =
    durationSeconds && Number.isFinite(durationSeconds) ? durationSeconds : 0;
  const [duration, setDuration] = useState(fallbackDuration);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const player = audio.current;
    return () => {
      sequence.current += 1;
      player?.pause();
      player?.removeAttribute("src");
      player?.load();
    };
  }, []);

  async function toggle() {
    const player = audio.current;
    if (!player || busy.current) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    busy.current = true;
    const attempt = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      let nextUrl = source;
      // Preserve an in-progress pause/resume, but refresh signed URLs on replay.
      if (!player.getAttribute("src") || player.ended || player.error) {
        if (!nextUrl && contentId != null) {
          const userId = getAuthenticatedUserId();
          const resource = cacheResources.referenceAudios(contentId);
          const cached = readUserClientCache<ReferenceAudio[]>(
            userId,
            resource,
          );
          const items =
            cached ?? (await api.content.getReferenceAudios(contentId));
          if (!cached) writeUserClientCache(userId, resource, items);
          if (attempt !== sequence.current) return;
          const selected = items.find((item) => item.primary) ?? items[0];
          if (!selected) throw new Error("등록된 기준 음성이 없습니다.");
          nextUrl = (
            await api.content.getReferenceAudioPlaybackUrl(selected.id)
          ).playbackUrl;
        }
        if (!nextUrl && recordingId != null) {
          nextUrl = (await api.training.getRecordingPlaybackUrl(recordingId))
            .playbackUrl;
        }
        if (attempt !== sequence.current) return;
        if (!nextUrl) throw new Error("재생할 음성이 없습니다.");
        // This is the sole source owner; React must not reassign src during play().
        if (player.getAttribute("src") !== nextUrl) player.src = nextUrl;
      }
      await player.play();
    } catch (reason) {
      if (attempt !== sequence.current) return;
      setPlaying(false);
      player.removeAttribute("src");
      setError(
        reason instanceof Error && reason.name === "AbortError"
          ? "재생이 중단됐습니다. 다시 재생해 주세요."
          : reason instanceof Error
            ? reason.message
            : "음성을 재생하지 못했습니다.",
      );
    } finally {
      if (attempt === sequence.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }
  const time = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
  if (variant === "guide")
    return (
      <section className="flex flex-col items-center gap-1.5">
        <audio
          ref={audio}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setError("가이드 음성을 불러오지 못했습니다.")}
        />
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void toggle()}
          aria-label={playing ? "가이드 일시 정지" : "가이드 듣기"}
          className="flex size-14 items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(26,33,48,0.06)] disabled:opacity-45"
        >
          {playing ? (
            <Pause className="size-[22px] text-[#4e5968]" />
          ) : (
            <Image
              src="/figma/practice/headphones.svg"
              alt=""
              width={22}
              height={22}
            />
          )}
        </button>
        <span className="text-[12px] leading-4 font-bold text-[#4e5968]">
          {loading ? "불러오는 중" : "가이드 듣기"}
        </span>
        {error && <span className="sr-only">{error}</span>}
      </section>
    );

  if (variant === "recording")
    return (
      <section className="w-full">
        <audio
          ref={audio}
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
          onError={() => setError("녹음 음성을 불러오지 못했습니다.")}
        />
        <div className="flex h-14 items-center gap-3 rounded-full bg-white py-2 pr-[18px] pl-2 shadow-[0_2px_4px_rgba(26,33,48,0.06)]">
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => void toggle()}
            aria-label={playing ? "전체 녹음 일시 정지" : "전체 녹음 재생"}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2f6bff] disabled:opacity-45"
          >
            {playing ? (
              <Pause className="size-4 text-white" />
            ) : (
              <Image
                src="/figma/practice/play-white.svg"
                alt=""
                width={16}
                height={16}
              />
            )}
          </button>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex text-[12px] leading-4 font-medium text-[#4e5968]">
              <span className="flex-1">{title}</span>
              <span className="text-[#6b7684]">
                {time(elapsed)} / {time(duration)}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#dfe3e8]">
              <div
                className="h-full rounded-full bg-[#2f6bff]"
                style={{
                  width: `${duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-center text-xs text-red-600">
            {error}
          </p>
        )}
      </section>
    );

  return (
    <section
      className={
        buttonTone
          ? "w-full"
          : compact
            ? "rounded-full bg-white/20 p-1.5 text-white"
            : "design-card"
      }
    >
      <div
        className={
          compact || buttonTone
            ? "sr-only"
            : "flex items-center justify-between"
        }
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">
          {time(playing ? elapsed : duration)}
        </span>
      </div>
      <audio
        ref={audio}
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
          setError("음성을 불러오지 못했습니다. 다시 재생해 주세요.");
        }}
      />
      {buttonTone ? (
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void toggle()}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] leading-5 font-bold disabled:opacity-60 ${
            buttonTone === "primary"
              ? "bg-[#edf2ff] text-primary"
              : "bg-[#f2f4f6] text-[#4e5968]"
          }`}
        >
          <Image
            src={
              buttonTone === "primary"
                ? "/figma/report/play.svg"
                : "/figma/report/headphones.svg"
            }
            alt=""
            width={18}
            height={18}
          />
          {loading ? "불러오는 중…" : playing ? "일시 정지" : title}
        </button>
      ) : compact ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={playing ? "내 녹음 일시 정지" : "내 녹음 재생"}
            disabled={disabled || loading}
            onClick={() => void toggle()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#2f6bff]"
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
