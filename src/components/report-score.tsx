"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./report-design.module.css";

/** Counts 0 → value once the element is first seen (instant with reduced motion). */
function useCountUp(
  value: number | null,
  root: React.RefObject<HTMLElement | null>,
) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    setDisplayed(0);
    if (value == null) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let started = false;
    const finish = () => {
      cancelAnimationFrame(frame);
      setDisplayed(value);
    };
    const onMotion = () => {
      if (motion.matches) finish();
    };
    motion.addEventListener("change", onMotion);
    const observer = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((entry) => entry.isIntersecting)) return;
        started = true;
        observer.disconnect();
        if (motion.matches) {
          finish();
          return;
        }
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / 1100);
          setDisplayed(value * (1 - Math.pow(1 - progress, 3)));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.35 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", onMotion);
    };
  }, [value, root]);
  return displayed;
}

function clampScore(score: number | null) {
  return score == null || !Number.isFinite(score)
    ? null
    : Math.max(0, Math.min(100, score));
}

const formatScore = (value: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);

/**
 * Compact headline: label with the counting score beneath it, left aligned.
 * Used where a chart below is the visual hero and the score is context.
 */
export function ReportScoreHeadline({
  score,
  title,
  previous,
}: {
  score: number | null;
  title: React.ReactNode;
  /** An earlier server score to compare against; omitted when there is none. */
  previous?: { score: number; scope: "retake" | "content" | "recent" } | null;
}) {
  const value = clampScore(score);
  const root = useRef<HTMLDivElement>(null);
  const displayed = useCountUp(value, root);
  const shown =
    value == null
      ? "—"
      : formatScore(displayed < value ? Math.floor(displayed) : value);
  return (
    <div
      ref={root}
      role="group"
      aria-label={value == null ? "종합 점수 미제공" : `종합 점수 ${value}점`}
    >
      {title}
      {/* Score sits under its label on the left, where the eye starts reading. */}
      <p className="mt-1 flex items-baseline gap-1" aria-hidden="true">
        <b className="text-[34px] leading-10 font-bold tracking-[-0.02em] text-[#191f28] tabular-nums">
          {shown}
        </b>
        {value != null && (
          <span className="text-[15px] font-bold text-[#191f28]">점</span>
        )}
        <span className="ml-1 text-[13px] text-[#b0b8c1]">/ 100</span>
      </p>
      {value != null && previous && (
        <ScoreChange delta={value - previous.score} scope={previous.scope} />
      )}
    </div>
  );
}

/** The arc is data driven: the design's 67-point example is never a fixed image. */
export function ReportScore({
  score,
  large = false,
}: {
  score: number | null;
  large?: boolean;
}) {
  const gradient = useId();
  const value = clampScore(score);
  const root = useRef<HTMLSpanElement>(null);
  const displayed = useCountUp(value, root);
  return (
    <span
      ref={root}
      className={styles.gauge}
      data-large={large}
      aria-label={value == null ? "점수 미제공" : `${value}점`}
    >
      <Image
        src={
          large
            ? "/figma/report-screen7/glow-large.svg"
            : "/figma/report-screen7/glow.svg"
        }
        alt=""
        width={large ? 141.2 : 88}
        height={large ? 141.2 : 88}
        className={styles.glow}
      />
      <svg viewBox="0 0 120 120" aria-hidden="true" className={styles.arc}>
        <defs>
          <linearGradient
            id={gradient}
            x1="0"
            y1="100"
            x2="110"
            y2="10"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#a08dff" />
            <stop offset="1" stopColor="#6346f6" />
          </linearGradient>
        </defs>
        <path
          d="M 21.816 98.184 A 54 54 0 1 1 98.184 98.184"
          fill="none"
          stroke="#efedf8"
          strokeWidth={large ? 9.6 : 12}
          strokeLinecap="round"
        />
        {value != null && displayed > 0 && (
          <path
            d="M 21.816 98.184 A 54 54 0 1 1 98.184 98.184"
            pathLength="100"
            fill="none"
            stroke={`url(#${gradient})`}
            strokeWidth={large ? 9.6 : 12}
            strokeLinecap="round"
            strokeDasharray={`${displayed} 100`}
          />
        )}
      </svg>
      <span className={styles.scoreValue} aria-hidden="true">
        <span>
          <b
            style={{
              color:
                value == null || value === 0 || displayed >= value
                  ? "#191f28"
                  : `rgb(${[176, 184, 193].map((start, index) => Math.round(start + (([25, 31, 40][index] - start) * displayed) / value)).join(", ")})`,
            }}
          >
            {value == null
              ? "—"
              : new Intl.NumberFormat("ko-KR", {
                  maximumFractionDigits: 1,
                }).format(displayed < value ? Math.floor(displayed) : value)}
          </b>
          {value != null && <small>점</small>}
        </span>
        {large && <em>{value == null ? "점수 미제공" : "100점 만점"}</em>}
      </span>
    </span>
  );
}

/** "▲ 4.2점 지난 기록 대비": up in brand purple, down in neutral grey. */
function ScoreChange({
  delta,
  scope,
}: {
  delta: number;
  scope: "retake" | "content" | "recent";
}) {
  const rounded = Math.round(delta * 10) / 10;
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "same";
  const basis =
    scope === "retake"
      ? "이전 녹음 대비"
      : scope === "content"
        ? "지난 기록 대비"
        : "최근 연습 대비";
  return (
    <p className="score-change mt-1.5 flex items-center gap-1.5 text-xs leading-4">
      <span
        className={`inline-flex items-center gap-0.5 rounded-[6px] px-1.5 py-[3px] font-bold tabular-nums ${
          direction === "up"
            ? "bg-[#f3f0ff] text-[#6346f6]"
            : "bg-[#f2f4f6] text-[#6b7684]"
        }`}
      >
        {direction === "same" ? (
          "변화 없음"
        ) : (
          <>
            <svg
              viewBox="0 0 8 6"
              className={`size-2 ${direction === "down" ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="M4 0 8 6H0z" fill="currentColor" />
            </svg>
            {formatScore(Math.abs(rounded))}점
          </>
        )}
      </span>
      <span className="text-[#8b95a1]">{basis}</span>
      <span className="sr-only">
        {direction === "up"
          ? "올랐어요"
          : direction === "down"
            ? "내려갔어요"
            : ""}
      </span>
    </p>
  );
}
