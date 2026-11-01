"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSentenceAudio } from "@/lib/sentence-audio";
import { prepareRecordingAudio } from "@/lib/recording-audio";

type Status = "idle" | "requesting" | "recording" | "done" | "denied" | "error";

/** The next local sentence starts at the split boundary, independently of HTTP or inference. */
export function useSentenceRecorder(
  onSegment: (index: number, blob: Blob) => number | null,
) {
  const [status, setStatus] = useState<Status>("idle");
  const [index, setIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callback = useRef(onSegment);
  callback.current = onSegment;
  const audio = useRef<Awaited<ReturnType<typeof createSentenceAudio>> | null>(
    null,
  );
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const currentIndex = useRef(0),
    generation = useRef(0),
    started = useRef(0);
  const running = useRef(false),
    transition = useRef(false),
    starting = useRef(false);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const release = useCallback(() => {
    if (clock.current) clearInterval(clock.current);
    clock.current = null;
    running.current = false;
    audio.current?.dispose();
    audio.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    const previous = context.current;
    context.current = null;
    if (previous && previous.state !== "closed")
      void previous.close().catch(() => undefined);
  }, []);
  const reset = useCallback(() => {
    generation.current++;
    release();
    transition.current = false;
    starting.current = false;
    setStatus("idle");
    setSplitting(false);
    setElapsedMs(0);
    setError(null);
  }, [release]);
  const advance = useCallback(async () => {
    if (!running.current || transition.current || !audio.current) return;
    transition.current = true;
    setSplitting(true);
    const epoch = generation.current;
    try {
      const blob = await audio.current.split();
      if (epoch !== generation.current) return;
      // Enqueue synchronously; the callback never waits for storage, upload or feedback.
      const next = callback.current(currentIndex.current, blob);
      if (next == null) {
        release();
        setStatus("done");
      } else {
        currentIndex.current = next;
        setIndex(next);
        started.current = Date.now();
        setElapsedMs(0);
      }
    } catch (reason) {
      if (epoch !== generation.current) return;
      release();
      setStatus("error");
      setError(
        reason instanceof Error ? reason.message : "녹음을 계속하지 못했어요.",
      );
    } finally {
      if (epoch === generation.current) {
        transition.current = false;
        setSplitting(false);
      }
    }
  }, [release]);
  const start = useCallback(
    async (initialIndex: number) => {
      if (starting.current || running.current) return;
      const epoch = ++generation.current;
      starting.current = true;
      setError(null);
      setStatus("requesting");
      try {
        // Resume during the initial user tap; this context stays open for all sentences.
        const activeContext = new AudioContext();
        context.current = activeContext;
        void activeContext.resume().catch(() => undefined);
        const activeStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (epoch !== generation.current) {
          activeStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = activeStream;
        const capture = await createSentenceAudio(activeContext, activeStream);
        if (epoch !== generation.current) {
          capture.dispose();
          return;
        }
        audio.current = capture;
        await prepareRecordingAudio(activeContext);
        if (epoch !== generation.current) return;
        currentIndex.current = initialIndex;
        setIndex(initialIndex);
        started.current = Date.now();
        setElapsedMs(0);
        capture.start();
        running.current = true;
        setStatus("recording");
        clock.current = setInterval(() => {
          const elapsed = Date.now() - started.current;
          setElapsedMs(elapsed);
          if (elapsed >= 60000) void advance();
        }, 200);
      } catch (reason) {
        if (epoch !== generation.current) return;
        release();
        const denied =
          reason instanceof DOMException &&
          ["NotAllowedError", "SecurityError"].includes(reason.name);
        setStatus(denied ? "denied" : "error");
        setError(
          denied
            ? "마이크 권한을 허용해 주세요."
            : "이 기기에서 연속 녹음을 시작하지 못했어요. 다시 시도해 주세요.",
        );
      } finally {
        if (epoch === generation.current) starting.current = false;
      }
    },
    [advance, release],
  );
  useEffect(
    () => () => {
      generation.current++;
      release();
    },
    [release],
  );
  return {
    status,
    index,
    elapsedMs,
    splitting,
    error,
    start,
    advance,
    reset,
    getStream: () => stream.current,
  };
}
