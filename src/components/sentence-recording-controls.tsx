"use client";
import { RecordingWaveform } from "./recording-waveform";
import { ArrowRight, Mic } from "lucide-react";
import { ReferencePlayer } from "./reference-player";
import type { Id } from "@/lib/api";
import styles from "./sentence-recording-controls.module.css";

/** Keep the controls mounted and anchored throughout microphone preparation. */
export function SentenceRecordingControls({
  contentId,
  stream,
  referenceAvailable,
  elapsed,
  busy,
  last,
  onComplete,
  recording,
  requesting,
  onStart,
}: {
  contentId: Id;
  stream: MediaStream | null;
  referenceAvailable: boolean;
  elapsed: string;
  busy: boolean;
  last: boolean;
  onComplete: () => void;
  recording: boolean;
  requesting: boolean;
  onStart: () => void;
}) {
  return (
    <section
      aria-label="문장 녹음 조작"
      data-recording={recording}
      className={styles.controls}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.meter} aria-hidden={!recording}>
        <RecordingWaveform stream={stream} paused={!recording || busy} />
        <p
          role="timer"
          aria-label="녹음 시간"
          className="flex items-center justify-center gap-2 text-base font-bold text-[#191f28] tabular-nums"
        >
          <span className="size-2 rounded-full bg-[#e32239]" />
          {busy && recording ? "녹음 마무리 중" : elapsed}
        </p>
      </div>
      <div className={styles.buttons}>
        <ReferencePlayer
          contentId={contentId}
          variant="guide"
          disabled={!referenceAvailable || requesting}
        />
        <button
          type="button"
          disabled={recording ? busy : requesting}
          onClick={recording ? onComplete : onStart}
          aria-label={
            recording
              ? last
                ? "전체 녹음 완료"
                : "문장 녹음 완료"
              : "녹음 시작"
          }
          aria-busy={requesting}
          className={styles.record}
        >
          <Mic size={32} className={styles.mic} aria-hidden="true" />
          <span className={styles.stop} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={!recording || busy}
          onClick={onComplete}
          aria-hidden={!recording}
          tabIndex={recording ? 0 : -1}
          className={styles.next}
        >
          <span className="grid size-14 place-items-center rounded-full bg-gradient-to-b from-[#191f28] to-[#104286] text-white">
            <ArrowRight size={24} />
          </span>
          {last ? "녹음 완료" : "다음 문장"}
        </button>
      </div>
      <p className={styles.hint} aria-live="polite">
        {requesting
          ? "마이크를 준비하고 있어요"
          : !recording
            ? "준비되면 마이크를 눌러 시작해요"
            : last
              ? "다 읽으면 정지 버튼으로 녹음을 완료해 주세요"
              : "다 읽으면 다음 문장으로 넘어가요"}
      </p>
    </section>
  );
}
