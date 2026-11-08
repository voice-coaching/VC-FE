import { ApiError } from "./api/client";
import type {
  Id,
  PracticeContent,
  PracticeExamples,
  TrainingSession,
} from "./api/types";
import { splitSentences } from "./sentences";

export type SentencePracticeItem = {
  key: string;
  contentId: Id;
  text: string;
  sentenceIndex: number;
  courseExampleIndex?: number;
};

export type SentenceAnalysisAdmission = {
  sessionId: Id;
  recordingId: Id;
  analysisId: Id;
};

export function assertSentenceSession(
  session: TrainingSession,
  admission: SentenceAnalysisAdmission,
  item: SentencePracticeItem,
) {
  if (
    String(session.id ?? session.sessionId) !== String(admission.sessionId) ||
    String(session.content?.id) !== String(item.contentId) ||
    session.content?.scriptText !== item.text ||
    session.content.sentenceIndex !== item.sentenceIndex ||
    String(session.selectedRecordingId) !== String(admission.recordingId)
  )
    throw new ApiError(
      "문장과 분석 세션이 일치하지 않습니다. 학습 기록을 확인해 주세요.",
      409,
      "SENTENCE_SEQUENCE_CHANGED",
    );
}

export function sentencePracticeItems(
  content: PracticeContent,
  examples?: PracticeExamples | null,
  startExample = 0,
): SentencePracticeItem[] {
  const sources = examples
    ? examples.items.slice(startExample).map((item, offset) => ({
        key: item.id,
        contentId: item.practiceContentId,
        text: item.text,
        courseExampleIndex: startExample + offset,
      }))
    : [
        {
          key: String(content.id),
          contentId: content.id,
          text: content.scriptText,
        },
      ];
  return sources.flatMap((source) =>
    splitSentences(source.text).map((text, sentenceIndex) => ({
      key: `${source.key}:${sentenceIndex}`,
      contentId: source.contentId,
      text,
      sentenceIndex,
      courseExampleIndex:
        "courseExampleIndex" in source ? source.courseExampleIndex : undefined,
    })),
  );
}

/** Only a server acknowledgement adds an item; duplicate callbacks cannot skip a sentence. */
export function appendSentenceAdmission(
  current: (SentenceAnalysisAdmission | null)[],
  index: number,
  admission: SentenceAnalysisAdmission,
) {
  const previous = current[index];
  if (
    previous &&
    ["sessionId", "recordingId", "analysisId"].every(
      (key) =>
        String(previous[key as keyof SentenceAnalysisAdmission]) ===
        String(admission[key as keyof SentenceAnalysisAdmission]),
    )
  )
    return current;
  if (
    previous ||
    current.some(
      (item) => item && String(item.sessionId) === String(admission.sessionId),
    )
  )
    throw new ApiError("??? ?? ??? ???????.", 409, "SENTENCE_SEQUENCE_CHANGED");
  const next = Array.from(
    { length: Math.max(current.length, index + 1) },
    (_, i) => current[i] ?? null,
  );
  next[index] = admission;
  return readSentenceAdmissions(next, next.length);
}

export function readSentenceAdmissions(raw: unknown, count: number) {
  if (raw == null) return [];
  if (
    !Array.isArray(raw) ||
    raw.length > count ||
    raw.some(
      (row) =>
        row != null &&
        [row.sessionId, row.recordingId, row.analysisId].some(
          (id) =>
            !/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id)),
        ),
    ) ||
    new Set(raw.filter(Boolean).map((row) => String(row.sessionId))).size !==
      raw.filter(Boolean).length
  )
    throw new ApiError(
      "이전 문장별 분석 기록을 확인해 주세요.",
      409,
      "SENTENCE_SEQUENCE_CHANGED",
    );
  return raw as (SentenceAnalysisAdmission | null)[];
}
