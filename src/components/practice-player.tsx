"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PracticeWave } from "./practice-wave";
const card = "rounded-2xl bg-white shadow-[0_2px_6px_rgba(23,23,23,0.05)]";
const press =
  "touch-manipulation transition-transform duration-200 active:scale-[0.98] motion-reduce:transition-none";
const formatTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

function Icon({
  name,
  size = 20,
  white = false,
}: {
  name: string;
  size?: number;
  white?: boolean;
}) {
  return (
    <Image
      src={`/figma/${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 ${white ? "brightness-0 invert" : ""}`}
    />
  );
}
export function PracticePlayer({
  review = false,
  compact = false,
  duration = review ? 24 : 4,
  onPositionChange,
  onPlayingChange,
  seekRequest,
  speedControl = false,
}: {
  review?: boolean;
  compact?: boolean;
  duration?: number;
  speedControl?: boolean;
  onPositionChange?: (position: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  seekRequest?: { position: number; id: number; playing?: boolean };
}) {
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [position, setPosition] = useState(0);
  const cursor = useRef(0);
  const [rate, setRate] = useState(1);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!seekRequest) return;
    cursor.current = Math.max(0, Math.min(duration, seekRequest.position));
    setPosition(cursor.current);
    setStarted(true);
    if (seekRequest.playing !== undefined) setPlaying(seekRequest.playing);
  }, [seekRequest, duration]);
  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);
  useEffect(() => {
    if (started) onPositionChange?.(position);
  }, [position, started, onPositionChange]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      cursor.current += ((now - last) / 1000) * rate;
      last = now;
      if (cursor.current >= duration) {
        if (repeat) cursor.current %= duration;
        else {
          cursor.current = duration;
          setPosition(duration);
          setPlaying(false);
          return;
        }
      }
      setPosition(cursor.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, repeat, duration, rate]);
  const toggle = () => {
    setStarted(true);
    if (cursor.current >= duration) {
      cursor.current = 0;
      setPosition(0);
    }
    setPlaying(!playing);
  };
  if (compact)
    return (
      <div className="mt-4 flex items-center gap-2 rounded-full bg-white/15 p-1.5 pr-4">
        <button
          onClick={toggle}
          aria-label={playing ? "일시정지" : "재생"}
          className={`${press} flex size-10 shrink-0 items-center justify-center rounded-full bg-white`}
        >
          <Icon name={`announcer/${playing ? "pause" : "play"}`} size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <PracticeWave compact pale active={playing} />
        </div>
        <span className="text-xs tabular-nums">
          {formatTime(position || duration)}
        </span>
      </div>
    );
  return (
    <section className={`${card} p-[18px]`}>
      <h2 className="mb-3 text-[15px] leading-[22px] font-bold">
        {review ? "내 녹음" : "예시 음성"}
      </h2>
      {review ? (
        <div className="flex items-center gap-3.5">
          <button
            onClick={toggle}
            aria-label={playing ? "일시정지" : "내 녹음 재생"}
            className={`${press} flex size-12 shrink-0 items-center justify-center rounded-full bg-[#2f6bff]`}
          >
            <Icon name={`announcer/${playing ? "pause" : "play"}`} white />
          </button>
          <div className="min-w-0 flex-1">
            <PracticeWave active={playing} />
          </div>
          <span className="text-[13px] text-[#8b95a1] tabular-nums">
            {formatTime(position || duration)}
          </span>
        </div>
      ) : (
        <>
          <PracticeWave active={playing} />
          <div className="relative mt-3.5 h-1.5 w-full rounded-full focus-within:ring-2 focus-within:ring-[#adc5ff] focus-within:ring-offset-4">
            <Image
              src="/figma/announcer/seek-track.svg"
              alt=""
              fill
              className="pointer-events-none rounded-full"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 origin-left rounded-full bg-[#2f6bff]"
              style={{ transform: `scaleX(${position / duration})` }}
            />
            <input
              aria-label="예시 음성 재생 위치"
              type="range"
              min={0}
              max={duration}
              step={0.01}
              value={position}
              onChange={(event) => {
                setStarted(true);
                cursor.current = Number(event.target.value);
                setPosition(cursor.current);
              }}
              className="absolute inset-x-0 top-1/2 m-0 h-11 w-full -translate-y-1/2 cursor-pointer opacity-0"
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] leading-[14px] text-[#8b95a1] tabular-nums">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="mt-3.5 flex gap-2.5">
            {speedControl && (
              <button
                onClick={() =>
                  setRate(rate === 1 ? 0.8 : rate === 0.8 ? 1.2 : 1)
                }
                aria-label={`재생 속도 ${rate}배속, 누르면 변경`}
                className={`${press} rounded-full bg-[#f7f8fa] px-3 text-[13px] text-[#4e5968]`}
              >
                {rate}배속
              </button>
            )}
            <button
              aria-pressed={repeat}
              onClick={() => setRepeat(!repeat)}
              className={`${press} flex items-center gap-1.5 rounded-full px-3.5 text-[13px] ${repeat ? "bg-[#edf2ff] text-[#2f6bff]" : "bg-[#f7f8fa] text-[#4e5968]"}`}
            >
              <Icon name="announcer/repeat" size={16} />
              반복
            </button>
            <button
              onClick={toggle}
              className={`${press} flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#edf2ff] font-bold text-[#2f6bff]`}
            >
              <Icon
                name={`announcer/${playing ? "pause" : "play"}`}
                size={18}
              />
              {playing ? "일시정지" : "재생"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
