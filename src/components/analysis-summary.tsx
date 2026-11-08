"use client";

import Image from "next/image";
import { useId, useState } from "react";
import styles from "./analysis-summary.module.css";

export function AnalysisSummary({
  text,
  plainText = false,
}: {
  text: string;
  plainText?: boolean;
}) {
  const id = useId();
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => {
      const listed = /^\s*[*•·-]\s+/.test(line);
      const clean = line
        .replace(/^\s*[*•·-]\s+/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .trim();
      const match = clean.match(/^(.{1,30}?)\s*(?:→|->|:)\s*([\s\S]+)$/);
      return { listed, title: match?.[1], body: match?.[2] || clean };
    })
    .filter((item) => item.body);
  const content = paragraphs.map((item, index) => (
    <div key={index} className={styles.paragraph}>
      {item.listed && (
        <Image
          src="/figma/report-improved/coaching-bullet.svg"
          alt=""
          width={4}
          height={22}
        />
      )}
      <p>
        {item.title && (
          <>
            <strong>{item.title}</strong>
            {"  "}
          </>
        )}
        {item.body}
      </p>
    </div>
  ));
  const [expanded, setExpanded] = useState(false);
  const overflows = paragraphs.length > 1;

  return (
    <div className={styles.card}>
      <div className={styles.heading}>
        <Image
          src="/figma/report-improved/ai-sparkle.svg"
          alt=""
          width={14}
          height={14}
        />
        <h2>AI 총평</h2>
      </div>
      <div id={id} className={styles.body}>
        {plainText ? (
          <p className={styles.text} style={{ whiteSpace: "pre-wrap" }}>
            {text}
          </p>
        ) : (
          <>
            <div className={styles.text}>{content[0]}</div>
            <div
              className={styles.remainder}
              data-expanded={expanded}
              inert={!expanded}
              aria-hidden={!expanded}
            >
              <div className={styles.remainderClip}>
                <div className={`${styles.text} ${styles.remainingText}`}>
                  {content.slice(1)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {!plainText && overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className={styles.toggle}
        >
          {expanded ? "접기" : "더 보기"}
          <Image
            src="/figma/report-improved/chevron-white.svg"
            alt=""
            width={14}
            height={14}
            style={{ transform: `rotate(${expanded ? -90 : 90}deg)` }}
          />
        </button>
      )}
    </div>
  );
}
