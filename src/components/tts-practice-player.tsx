"use client";

import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PracticeExample } from "@/lib/practice-examples";

type PlaybackStatus = "idle" | "loading" | "playing";

export function TtsPracticePlayer({ example }: { example: PracticeExample }) {
  const audio = useRef<HTMLAudioElement>(null);
  const urls = useRef(new Map<string, string>());
  const requestSequence = useRef(0);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    requestSequence.current += 1;
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    setStatus("idle");
    setNotice(null);
  }, [example.id]);

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      for (const url of urls.current.values()) URL.revokeObjectURL(url);
    },
    [],
  );

  function playWithDeviceVoice() {
    if (!("speechSynthesis" in window)) {
      setStatus("idle");
      setNotice("이 브라우저에서는 음성 재생을 지원하지 않습니다.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(example.text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.92;
    utterance.voice =
      window.speechSynthesis
        .getVoices()
        .find((voice) => voice.lang.toLowerCase().startsWith("ko")) ?? null;
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => {
      setStatus("idle");
      setNotice("기기 음성을 재생하지 못했습니다.");
    };
    setNotice("Chirp 음성을 사용할 수 없어 기기 음성으로 재생하고 있어요.");
    setStatus("playing");
    window.speechSynthesis.speak(utterance);
  }

  async function play() {
    const player = audio.current;
    if (!player) return;
    if (status === "playing") {
      player.pause();
      window.speechSynthesis?.cancel();
      setStatus("idle");
      return;
    }

    const sequence = ++requestSequence.current;
    setStatus("loading");
    setNotice(null);
    try {
      let url = urls.current.get(example.id);
      if (!url) {
        const response = await fetch(
          `/api/tts?exampleId=${encodeURIComponent(example.id)}`,
        );
        if (!response.ok) throw new Error("Google Chirp TTS unavailable");
        url = URL.createObjectURL(await response.blob());
        urls.current.set(example.id, url);
      }
      if (sequence !== requestSequence.current) return;
      player.src = url;
      await player.play();
      setStatus("playing");
    } catch {
      if (sequence === requestSequence.current) playWithDeviceVoice();
    }
  }

  return (
    <div className="rounded-2xl bg-[#edf2ff] p-4">
      <audio
        ref={audio}
        onEnded={() => setStatus("idle")}
        onPause={() => status === "playing" && setStatus("idle")}
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
          ? "Chirp 음성 만드는 중…"
          : status === "playing"
            ? "음성 멈추기"
            : "Chirp 음성 듣기"}
      </button>
      {notice && (
        <p
          role="status"
          className="mt-2 text-center text-[11px] text-[#4e5968]"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
