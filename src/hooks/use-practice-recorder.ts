"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSentenceRecorder } from "./use-sentence-recorder";
import { joinPcmCaptures } from "@/lib/practice-capture";

/** Share continuous capture in local, resumed and exam flows without changing their server identity. */
export function usePracticeRecorder(sentenceCount: number) {
  const chunks = useRef<Blob[]>([]),
    epoch = useRef(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [boundaries, setBoundaries] = useState<number[]>([0]);
  const capture = useSentenceRecorder((index, part) => {
    chunks.current[index] = part;
    if (index + 1 < sentenceCount) return index + 1;
    const current = epoch.current;
    void joinPcmCaptures([...chunks.current])
      .then((result) => {
        if (current === epoch.current) {
          setBlob(result.blob);
          setDurationMs(result.durationMs);
          setBoundaries(result.boundaries);
        }
      })
      .catch((reason) => {
        if (current === epoch.current)
          setError(
            reason instanceof Error
              ? reason.message
              : "녹음을 확인하지 못했어요.",
          );
      });
    return null;
  });
  const previewUrl = useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  const status = error
    ? "error"
    : capture.status === "done"
      ? blob
        ? "recorded"
        : "stopping"
      : capture.status;
  return {
    blob,
    previewUrl,
    durationMs,
    error: error ?? capture.error,
    status,
    sentenceIndex: capture.index,
    splitting: capture.splitting,
    boundaries,
    elapsedMs: capture.elapsedMs,
    getElapsedMs: () => capture.elapsedMs,
    getStream: capture.getStream,
    stop: capture.advance,
    unlockAudio: () => {},
    start: async () => {
      epoch.current++;
      chunks.current = [];
      setBoundaries([0]);
      setBlob(null);
      setDurationMs(0);
      setError(null);
      return capture.start(0);
    },
    reset: () => {
      epoch.current++;
      chunks.current = [];
      setBoundaries([0]);
      setBlob(null);
      setDurationMs(0);
      setError(null);
      capture.reset();
    },
  };
}
