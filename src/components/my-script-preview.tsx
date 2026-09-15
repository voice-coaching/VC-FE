"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const bars = [
  10, 20, 32, 16, 38, 24, 12, 30, 42, 22, 12, 28, 36, 18, 26, 20, 34, 14, 24,
  16, 30, 20,
];
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;

export function MyScriptPreview({ sentences }: { sentences: string[] }) {
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.9);
  const [position, setPosition] = useState(0);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const script = sentences.map((sentence) => sentence.trim()).join(" ");
  const duration = Math.max(1, Math.ceil(script.length / (5 * rate)));

  useEffect(
    () => () => {
      generation.current += 1;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  function start(offset = 0, speed = rate) {
    if (!("speechSynthesis" in window)) {
      setError("이 브라우저에서는 미리 듣기를 지원하지 않습니다.");
      return;
    }
    const version = ++generation.current;
    window.speechSynthesis.cancel();
    setError(null);
    let cursor = 0;
    const starts = sentences.map((sentence) => {
      const value = cursor;
      cursor += sentence.trim().length + 1;
      return value;
    });
    const update = (character: number) => {
      setPosition(character / Math.max(1, script.length));
      setActive(
        starts.reduce(
          (found, value, index) => (value <= character ? index : found),
          -1,
        ),
      );
    };
    update(offset);
    const utterance = new SpeechSynthesisUtterance(script.slice(offset));
    utteranceRef.current = utterance;
    utterance.lang = "ko-KR";
    utterance.rate = speed;
    utterance.onboundary = (event) => {
      if (generation.current === version) update(offset + event.charIndex);
    };
    utterance.onend = () => {
      if (generation.current !== version) return;
      setPlaying(false);
      setPosition(1);
      setActive(-1);
      utteranceRef.current = null;
    };
    utterance.onerror = (event) => {
      if (
        generation.current !== version ||
        event.error === "canceled" ||
        event.error === "interrupted"
      )
        return;
      setPlaying(false);
      setError("미리 듣기를 재생하지 못했습니다. 다시 시도해 주세요.");
    };
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  function toggle() {
    if (playing) {
      window.speechSynthesis.pause();
      setPlaying(false);
    } else if (utteranceRef.current && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPlaying(true);
    } else start(position >= 1 ? 0 : Math.floor(position * script.length));
  }

  return (
    <>
      <section
        className="flex flex-col gap-3.5 rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
        aria-label="예시 음성"
      >
        <h3 className="text-[15px] leading-[22px] font-bold tracking-[0.144px]">
          예시 음성
        </h3>
        <div
          className="flex h-12 items-center justify-center gap-1"
          aria-hidden="true"
        >
          {bars.map((height, index) => (
            <span
              key={index}
              className={`w-1 rounded-[2px] ${index / bars.length < position ? "bg-primary" : "bg-[#e5e8eb]"}`}
              style={{ height }}
            />
          ))}
        </div>
        <div className="space-y-1.5">
          <input
            className="script-seek"
            type="range"
            min={0}
            max={100}
            value={Math.round(position * 100)}
            aria-label="예시 음성 재생 위치"
            style={{
              background: `linear-gradient(to right, #2f6bff ${position * 100}%, #e5e8eb ${position * 100}%)`,
            }}
            onChange={(event) => {
              const value = Number(event.target.value) / 100;
              generation.current += 1;
              if ("speechSynthesis" in window) window.speechSynthesis.cancel();
              utteranceRef.current = null;
              setPosition(value);
              setActive(-1);
              if (playing && value < 1)
                start(Math.floor(value * script.length));
              else setPlaying(false);
            }}
          />
          <div
            className="flex justify-between text-[11px] leading-[14px] font-medium tracking-[0.3421px] text-[#8b95a1]"
            title="브라우저 음성 합성의 예상 재생 시간입니다."
          >
            <span>{clock(position * duration)}</span>
            <span>약 {clock(duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label={`재생 속도 ${rate}배속, 눌러서 변경`}
            className="rounded-full bg-[#f7f8fa] px-3.5 py-[15px] text-[13px] leading-[18px] font-medium text-[#4e5968]"
            onClick={() => {
              const next = rate === 0.9 ? 1 : rate === 1 ? 1.2 : 0.9;
              setRate(next);
              if (playing) start(Math.floor(position * script.length), next);
              else {
                generation.current += 1;
                if ("speechSynthesis" in window)
                  window.speechSynthesis.cancel();
                utteranceRef.current = null;
              }
            }}
          >
            {rate}배속
          </button>
          <button
            type="button"
            onClick={toggle}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#edf2ff] px-5 text-base leading-6 font-bold text-primary"
          >
            <Image
              src={
                playing
                  ? "/figma/auth/script-pause.svg"
                  : "/figma/announcer/play.svg"
              }
              alt=""
              width={18}
              height={18}
            />
            {playing ? "일시정지" : "재생"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </section>
      <section className="space-y-2" aria-labelledby="preview-script-heading">
        <h3
          id="preview-script-heading"
          className="text-[15px] leading-[22px] font-bold tracking-[0.144px]"
        >
          내 원고
        </h3>
        <ol className="space-y-1 rounded-2xl bg-white p-3 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
          {sentences.map((sentence, index) => (
            <li
              key={index}
              aria-current={active === index ? "true" : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-[11px] ${active === index ? "bg-[#edf2ff]" : ""}`}
            >
              <span
                aria-hidden="true"
                className={`shrink-0 text-xs leading-4 font-medium ${active === index ? "text-primary" : "text-[#b0b8c1]"}`}
              >
                {index + 1}
              </span>
              <p
                className={`min-w-0 flex-1 text-[15px] leading-[22px] tracking-[0.144px] [overflow-wrap:anywhere] ${active === index ? "font-bold" : "text-[#4e5968]"}`}
              >
                {sentence.trim()}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
