"use client";

import { ReferencePlayer } from "@/components/reference-player";
import type { Id } from "@/lib/api";
import type { DirectResult } from "@/lib/direct-analysis";
import styles from "./report-design.module.css";

export type ReportCorrection = DirectResult["coaching"]["items"][number];

export function CorrectionComparison({
  item,
  recordingUrl,
  recordingId,
  disabled = false,
  detail = false,
}: {
  item: ReportCorrection;
  recordingUrl?: string;
  recordingId?: Id;
  disabled?: boolean;
  detail?: boolean;
}) {
  const { candidate, expression } = item;
  const location = candidate.facts[0]?.location;
  const range =
    location &&
    location.wordStartS >= 0 &&
    location.wordEndS > location.wordStartS
      ? { startSeconds: location.wordStartS, endSeconds: location.wordEndS }
      : {};
  return (
    <>
      <div className={styles.correction}>
        <div className={styles.comparisonLine}>
          <span className={styles.chip}>관측 소리</span>
          <strong className="text-[#e5404e]">
            {candidate.observedCandidate}
          </strong>
          <ReferencePlayer
            source={recordingUrl}
            recordingId={recordingId}
            {...range}
            title="해당 구간 내 음성 듣기"
            variant="comparison"
            disabled={disabled || (!recordingUrl && recordingId == null)}
          />
        </div>
        <div className={styles.comparisonLine}>
          <span className={styles.chip} data-tone="correct">
            목표 소리
          </span>
          <strong className="text-primary">{candidate.expectedPhone}</strong>
        </div>
        <div className={styles.feedbackLine}>
          <span className={styles.chip} data-tone="feedback">
            피드백
          </span>
          <p>
            {expression.explanation}
            {"\n"}
            {expression.action}
          </p>
        </div>
      </div>
      {detail && (
        <div className={styles.tip}>
          <strong>TIP</strong>
          <p>{expression.practice}</p>
          <p className="mt-1">{expression.selfCheck}</p>
        </div>
      )}
    </>
  );
}
