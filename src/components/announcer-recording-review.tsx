"use client";

import { Play, Pause } from "lucide-react";
import { useRef, useState } from "react";
import { PracticeWave } from "./practice-wave";

export function AnnouncerRecordingReview({
  url,
  durationMs,
}: {
  blob: Blob;
  url: string;
  durationMs: number;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState("");

  const seconds = Math.floor((position || durationMs) / 1000);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section
      className="mt-3.5 rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
      aria-label="내 녹음"
    >
      <h2 className="text-[16px] leading-6 font-bold">내 녹음</h2>
      <div className="mt-3 flex h-12 items-center gap-3.5">
        <button
          type="button"
          aria-label={playing ? "내 녹음 일시정지" : "내 녹음 재생"}
          onClick={() => {
            setError("");
            if (playing) audio.current?.pause();
            else
              void audio.current
                ?.play()
                .catch(() =>
                  setError("녹음을 재생하지 못했어요. 다시 눌러주세요."),
                );
          }}
          className="flex size-12 shrink-0 touch-manipulation items-center justify-center rounded-full bg-[#2f6bff] text-white transition-transform duration-200 active:scale-[0.98] motion-reduce:transition-none"
        >
          {playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <div
          className="relative flex h-12 min-w-0 flex-1 items-center justify-between"
          aria-hidden="true"
        >
          <PracticeWave active={playing} />
        </div>
        <span className="shrink-0 text-[13px] font-medium text-[#8b95a1] tabular-nums">
          {time}
        </span>
      </div>
      <audio
        ref={audio}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onTimeUpdate={() =>
          setPosition((audio.current?.currentTime ?? 0) * 1000)
        }
        onError={() => {
          setPlaying(false);
          setError("녹음을 재생하지 못했어요.");
        }}
      />
      {error && (
        <p role="alert" className="mt-3 text-xs text-[#d91b34]">
          {error}
        </p>
      )}
    </section>
  );
}
