"use client";

import Image from "next/image";
import { Pause } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Id } from "@/lib/api";
import { referencePlayback } from "@/lib/audio-playback";
import { createSpeechGuide } from "@/lib/speech-guide";
import { ReferencePlayer } from "./reference-player";

type GuideProps = {
  contentId: Id;
  available: boolean;
  text: string;
  title?: string;
  variant?: "guide" | "comparison";
  buttonTone?: "primary" | "neutral";
  dense?: boolean;
  disabled?: boolean;
};

export function GuidePlayer(props: GuideProps) {
  if (props.available) return <ReferencePlayer {...props} />;
  return <DeviceGuide key={props.text} {...props} />;
}

function DeviceGuide({
  text,
  title = "가이드 전체 듣기",
  variant,
  buttonTone = "neutral",
  dense = false,
  disabled = false,
}: GuideProps) {
  const player = useRef<ReturnType<typeof createSpeechGuide> | null>(null);
  const [playbackId] = useState(() => Symbol("device-guide"));
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = useSyncExternalStore(
    referencePlayback.subscribe,
    referencePlayback.getSnapshot,
    () => null,
  );
  const blocked = owner !== null && owner !== playbackId;
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const guide = createSpeechGuide(
      text,
      window.speechSynthesis,
      (value) => new SpeechSynthesisUtterance(value),
      (next, message) => {
        setPlaying(next);
        if (message) setError(message);
      },
      playbackId,
    );
    player.current = guide;
    return () => {
      guide.dispose();
      player.current = null;
    };
  }, [text, playbackId]);
  const compact = variant === "guide";
  const comparison = variant === "comparison";
  return (
    <section
      className={compact ? "flex flex-col items-center gap-1.5" : "w-full"}
    >
      <button
        type="button"
        disabled={disabled || blocked || !text.trim()}
        onClick={() => {
          setError(null);
          if (player.current) player.current.toggle();
          else setError("이 기기에서 가이드 음성을 사용할 수 없어요.");
        }}
        aria-label={playing ? `${title} 일시 정지` : title}
        className={
          compact
            ? "flex size-14 items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(26,33,48,0.06)] disabled:opacity-45"
            : comparison
              ? "flex size-[26px] items-center justify-center rounded-full border border-[#e4ebfa] bg-white text-[#8b95a1] disabled:opacity-40"
              : `flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl px-2 py-2 leading-5 font-bold disabled:opacity-60 ${dense ? "text-[13px]" : "text-[14px]"} ${buttonTone === "primary" ? "bg-[#edf2ff] text-primary" : "bg-[#f2f4f6] text-[#4e5968]"}`
        }
      >
        {playing ? (
          <Pause
            className={comparison ? "size-3" : "size-[22px]"}
            aria-hidden="true"
          />
        ) : (
          <Image
            src={
              compact
                ? "/figma/practice/headphones.svg"
                : comparison
                  ? "/figma/report-improved/play-muted.svg"
                  : dense
                    ? "/figma/report-improved/headphones.svg"
                    : "/figma/report/headphones.svg"
            }
            alt=""
            width={compact ? 22 : comparison ? 12 : dense ? 16 : 18}
            height={compact ? 22 : comparison ? 12 : dense ? 16 : 18}
          />
        )}
        {!compact && !comparison && (playing ? "일시 정지" : title)}
      </button>
      {compact && (
        <span className="text-[12px] leading-4 font-bold text-[#4e5968]">
          가이드 듣기
        </span>
      )}
      <span className="sr-only">기기 음성으로 읽어 주는 가이드</span>
      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
