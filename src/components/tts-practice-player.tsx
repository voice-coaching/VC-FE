"use client";

import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, type PracticeExample } from "@/lib/api";

type PlaybackStatus = "idle" | "loading" | "playing";

export function TtsPracticePlayer({ example }: { example: PracticeExample }) {
  const audio = useRef<HTMLAudioElement>(null);
  const pending = useRef<AbortController | null>(null);
  const currentUrl = useRef<string | null>(null);
  const sequence = useRef(0);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const player = audio.current;
    return () => {
      sequence.current += 1;
      pending.current?.abort();
      player?.pause();
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = null;
    };
  }, [example.id]);

  async function play() {
    const player = audio.current;
    if (!player) return;
    if (status === "playing") {
      player.pause();
      setStatus("idle");
      return;
    }
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

  return (
    <div className="rounded-2xl bg-[#edf2ff] p-4">
      <audio
        ref={audio}
        onEnded={() => setStatus("idle")}
        onError={() => {
          setStatus("idle");
          setNotice("음성을 재생하지 못했습니다. 다시 시도해 주세요.");
        }}
      />
      <button
        type="button"
        disabled={status === "loading"}
        onClick={() => void play()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {status === "playing" ? (
          <Pause className="size-4" />
        ) : status === "loading" ? (
          <Volume2 className="size-4" />
        ) : (
          <Play className="size-4" fill="currentColor" />
        )}
        {status === "loading"
          ? "예시 음성 준비 중…"
          : status === "playing"
            ? "음성 멈추기"
            : "예시 발음 듣기"}
      </button>
      {notice && (
        <p role="status" className="mt-2 text-center text-xs text-[#4e5968]">
          {notice}
        </p>
      )}
    </div>
  );
}
