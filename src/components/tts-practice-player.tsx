"use client";

import { LoaderCircle, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, type PracticeExample } from "@/lib/api";

type PlaybackStatus = "idle" | "loading" | "playing";

export function useTtsPracticePlayer(enabled: boolean) {
  const audio = useRef<HTMLAudioElement>(null);
  const pending = useRef<AbortController | null>(null);
  const currentUrl = useRef<string | null>(null);
  const sequence = useRef(0);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const player = audio.current;
    return () => {
      sequence.current += 1;
      setStatus("idle");
      setActiveId(null);
      pending.current?.abort();
      player?.pause();
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = null;
    };
  }, [enabled]);

  async function play(example: PracticeExample) {
    const player = audio.current;
    if (!player) return;
    if (activeId === example.id && status === "playing" && !player.paused) {
      player.pause();
      setStatus("idle");
      setActiveId(null);
      return;
    }
    player.pause();
    setActiveId(example.id);
    const attempt = ++sequence.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setStatus("loading");
    setNotice(null);
    try {
      // Re-authorize every replay. The backend owns the reusable audio cache.
      const blob = await api.examples.getAudio(example.id, controller.signal);
      if (attempt !== sequence.current) return;
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = URL.createObjectURL(blob);
      player.src = currentUrl.current;
      await player.play();
      if (attempt === sequence.current) setStatus("playing");
    } catch (reason) {
      if (attempt !== sequence.current) return;
      setStatus("idle");
      const message =
        reason instanceof ApiError
          ? reason.status === 401
            ? "로그인 후 예시 음성을 다시 들어 주세요."
            : reason.status === 404
              ? "등록된 예시 음성을 찾을 수 없습니다."
              : reason.status === 429
                ? "요청이 많습니다. 잠시 후 다시 시도해 주세요."
                : reason.status === 503
                  ? "예시 음성이 아직 준비되지 않았습니다."
                  : reason.message
          : "음성을 재생하지 못했습니다. 다시 눌러 재생해 주세요.";
      setNotice(message);
    }
  }

  return {
    play,
    activeId,
    status,
    notice,
    audio: (
      <audio
        ref={audio}
        onEnded={() => {
          setStatus("idle");
          setActiveId(null);
        }}
        onError={() => {
          setStatus("idle");
          setNotice("음성을 재생하지 못했습니다. 다시 눌러 재생해 주세요.");
        }}
      />
    ),
  };
}

export function TtsPracticeButton({
  example,
  index,
  player,
}: {
  example: PracticeExample;
  index: number;
  player: ReturnType<typeof useTtsPracticePlayer>;
}) {
  const active = player.activeId === example.id;
  const loading = active && player.status === "loading";
  const playing = active && player.status === "playing";
  return (
    <div className="shrink-0">
      <button
        type="button"
        disabled={loading}
        onClick={() => void player.play(example)}
        aria-label={`${index + 1}번 예문 ${loading ? "불러오는 중" : playing ? "일시 정지" : "재생"}`}
        aria-busy={loading}
        className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-[#f1edff] px-3 text-xs font-semibold text-[#6346f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6346f6] disabled:cursor-wait"
      >
        {loading ? (
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : playing ? (
          <Pause className="size-4" fill="currentColor" aria-hidden="true" />
        ) : (
          <Play className="size-4" fill="currentColor" aria-hidden="true" />
        )}
        {loading ? "불러오는 중" : playing ? "일시 정지" : "예시 듣기"}
      </button>
      {active && player.notice && (
        <p role="status" className="mt-1 max-w-28 text-xs text-destructive">
          {player.notice}
        </p>
      )}
    </div>
  );
}
