"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./analysis-summary.module.css";

export function AnalysisSummary({ text }: { text: string }) {
  const id = useId();
  const probe = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const element = probe.current;
    if (!element) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(
        getComputedStyle(element).lineHeight,
      );
      const next = element.scrollHeight > lineHeight * 3 + 1;
      setOverflows(next);
      if (!next) setExpanded(false);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div className={styles.card}>
      <div className={styles.heading}>
        <Image
          src="/figma/report/ai-sparkle.svg"
          alt=""
          width={18}
          height={18}
        />
        <h2>AI 총평</h2>
      </div>
      <div className={styles.body}>
        <p
          id={id}
          className={`${styles.text} ${expanded ? "" : styles.collapsed}`}
        >
          {text}
        </p>
        <p
          ref={probe}
          aria-hidden="true"
          className={`${styles.text} ${styles.probe}`}
        >
          {text}
        </p>
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className={styles.toggle}
        >
          {expanded ? "접기" : "더보기"}
          <Image
            src="/figma/report/chevron-white.svg"
            alt=""
            width={16}
            height={16}
            style={{ transform: `rotate(${expanded ? -90 : 90}deg)` }}
          />
        </button>
      )}
    </div>
  );
}
