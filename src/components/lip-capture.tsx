"use client";
import Image from "next/image";
import { useEffect, useState, type RefObject } from "react";
import { BackButton } from "./back-button";
import styles from "./lip-capture.module.css";
export function LipCapture({
  videoRef,
  mirrored,
  prompts,
  index,
  countdown,
  startedAt,
  busy,
  onNext,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  mirrored: boolean;
  prompts: readonly string[];
  index: number;
  countdown: number | null;
  startedAt: number;
  busy: boolean;
  onNext: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsed(
        countdown === null
          ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
          : 0,
      );
    update();
    const timer = window.setInterval(update, 250);
    return () => clearInterval(timer);
  }, [startedAt, countdown]);
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <BackButton fallback="/home" label="입 모양 연습 닫기">
          <Image
            src="/figma/lip-quick-start/camera-close.svg"
            width={24}
            height={24}
            alt=""
          />
        </BackButton>
        <div
          className={styles.progress}
          aria-label={`${prompts.length}문장 중 ${index + 1}번째`}
        >
          {prompts.map((_, i) => (
            <span key={i} data-active={i <= index} />
          ))}
        </div>
        <span>
          {index + 1}/{prompts.length}
        </span>
      </header>
      <div className={styles.camera}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
        />
        {countdown === null ? (
          <div className={styles.timer}>
            <Image
              src="/figma/lip-quick-start/record-dot.svg"
              width={8}
              height={8}
              alt="촬영 중"
            />
            {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
            {String(elapsed % 60).padStart(2, "0")}
            <span className={styles.meter} aria-hidden>
              {[6, 10, 14, 10, 12, 6].map((h, i) => (
                <i key={i} style={{ height: h }} />
              ))}
            </span>
          </div>
        ) : (
          <div className={styles.countdown} key={`countdown-${countdown}`}>
            {countdown || ""}
          </div>
        )}
        <div
          className={styles.sentences}
          key={`sentence-${index}`}
          aria-live="polite"
        >
          {index > 0 && <p className={styles.previous}>{prompts[index - 1]}</p>}
          <p className={styles.current} data-long={prompts[index].length > 35}>
            {prompts[index]}
          </p>
          {index + 1 < prompts.length && (
            <p className={styles.upcoming}>{prompts[index + 1]}</p>
          )}
        </div>
      </div>
      <footer className={styles.footer}>
        <button disabled={countdown !== null || busy} onClick={onNext}>
          {index === prompts.length - 1 ? "다 읽었어요" : "다음 문장"}
        </button>
      </footer>
    </div>
  );
}
