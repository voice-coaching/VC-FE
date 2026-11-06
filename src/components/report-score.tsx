"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./report-design.module.css";

/** The arc is data driven: the design's 67-point example is never a fixed image. */
export function ReportScore({
  score,
  large = false,
}: {
  score: number | null;
  large?: boolean;
}) {
  const gradient = useId();
  const value =
    score == null || !Number.isFinite(score)
      ? null
      : Math.max(0, Math.min(100, score));
  const root = useRef<HTMLSpanElement>(null);
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
  }, [value]);
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
