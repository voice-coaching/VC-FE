"use client";

import Image from "next/image";
import { useId } from "react";
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
  return (
    <span className={styles.gauge} data-large={large}>
      <Image
        src={
          large
            ? "/figma/report-improved/glow-large.svg"
            : "/figma/report-improved/glow.svg"
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
            <stop stopColor="#8db1ff" />
            <stop offset="1" stopColor="#2f6bff" />
          </linearGradient>
        </defs>
        <path
          d="M 21.816 98.184 A 54 54 0 1 1 98.184 98.184"
          fill="none"
          stroke="#e6ecf7"
          strokeWidth={large ? 9.6 : 12}
          strokeLinecap="round"
        />
        {value != null && value > 0 && (
          <path
            d="M 21.816 98.184 A 54 54 0 1 1 98.184 98.184"
            pathLength="100"
            fill="none"
            stroke={`url(#${gradient})`}
            strokeWidth={large ? 9.6 : 12}
            strokeLinecap="round"
            strokeDasharray={`${value} 100`}
          />
        )}
      </svg>
      <span className={styles.scoreValue}>
        <span>
          <b>
            {value == null
              ? "—"
              : new Intl.NumberFormat("ko-KR", {
                  maximumFractionDigits: 1,
                }).format(value)}
          </b>
          {value != null && <small>점</small>}
        </span>
        {large && <em>{value == null ? "점수 미제공" : "100점 만점"}</em>}
      </span>
    </span>
  );
}
