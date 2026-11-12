"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSentenceRecorder } from "./use-sentence-recorder";
import { pcmCapture } from "@/lib/practice-capture";
import { sentenceRecordings } from "@/lib/sentence-recordings";
import { admittedSequenceHref } from "@/lib/practice-entry";
import type {
  SentenceAnalysisAdmission,
  SentencePracticeItem,
} from "@/lib/sentence-sequence";

export type CapturedSentence = { blob: Blob; durationMs: number };

/** Capture all visible practice types locally while their authenticated submissions run independently. */
export function useAuthenticatedSentenceCapture(
  items: SentencePracticeItem[],
  admissions: (SentenceAnalysisAdmission | null)[],
  options: {
    userId: string | null;
    resource: string;
    resume: boolean;
    ready: boolean;
  },
) {
  const identity = JSON.stringify(items);
  const scope = `authenticated-sentence-capture:v1:${options.userId}:${options.resource}`;
  const [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<number, CapturedSentence>>({});
  const [recorded, setRecorded] = useState<number[]>([]),
    [saving, setSaving] = useState(0);
  const [failedSave, setFailedSave] = useState<number | null>(null);
  const raw = useRef(new Map<number, Blob>());
  const pending = useRef(new Set<Promise<void>>());
  const failures = useRef(new Map<number, string>());
  const run = useRef<{ scope: string; runId: string } | null>(null);
  const [recoveryScope, setRecoveryScope] = useState<string>();
  const owner = useRef(0);
  const accepted = useRef(admissions);
  useLayoutEffect(() => {
    accepted.current = admissions;
  }, [admissions]);
  const storageKey = (index: number) =>
    `${scope}:${run.current!.runId}:${index}`;
  function next(): number | null {
    const index = items.findIndex(
      (_, index) => !accepted.current[index] && !raw.current.has(index),
    );
    return index < 0 ? null : index;
  }
  function save(index: number, blob: Blob): void {
    const epoch = owner.current;
    const target = storageKey(index);
    setSaving((count) => count + 1);
    const write = pcmCapture(blob)
      .then(async (capture) => {
        await sentenceRecordings.put(target, blob);
        if (epoch !== owner.current) return;
        setFiles((current) => ({ ...current, [index]: capture }));
        failures.current.delete(index);
        const nextFailure = [...failures.current.entries()][0];
        setFailedSave(nextFailure?.[0] ?? null);
        setError(nextFailure?.[1] ?? null);
      })
      .catch((reason) => {
        if (epoch === owner.current) {
          const message =
            reason instanceof Error
              ? reason.message
              : "문장 녹음을 보관하지 못했어요.";
          failures.current.set(index, message);
          setFailedSave(index);
          setError(message);
        }
      })
      .finally(() => {
        pending.current.delete(write);
        if (epoch === owner.current) setSaving((count) => count - 1);
      });
    pending.current.add(write);
  }
  const recorder = useSentenceRecorder((index, blob) => {
    raw.current.set(index, blob);
    setRecorded([...raw.current.keys()]);
    save(index, blob);
    if (
      new URLSearchParams(window.location.search).get("resumeSequence") !== "1"
    )
      window.history.replaceState(
        null,
        "",
        admittedSequenceHref(window.location.href),
      );
    return next();
  });
  useEffect(() => {
    if (!options.ready) return;
    const epoch = ++owner.current;
    let disposed = false;
    setReady(false);
    void (async () => {
      try {
        if (!options.userId)
          throw new Error("로그인 후 문장 연습을 다시 열어 주세요.");
        let runId = run.current?.scope === scope ? run.current.runId : null;
        if (!runId && options.resume) {
          const text = localStorage.getItem(scope);
          if (text) {
            const value = JSON.parse(text);
            if (
              value.identity !== identity ||
              typeof value.runId !== "string" ||
              !/^[0-9a-f-]{36}$/.test(value.runId)
            )
              throw new Error(
                "이전 녹음의 문장 목록이 달라요. 새 연습을 시작해 주세요.",
              );
            runId = value.runId;
          }
        }
        runId ??= crypto.randomUUID();
        run.current = { scope, runId };
        setRecoveryScope(`${scope}:${runId}`);
        localStorage.setItem(scope, JSON.stringify({ identity, runId }));
        const restored = await Promise.all(
          items.map(async (_, index) => {
            const blob = await sentenceRecordings.read(storageKey(index));
            return blob ? { index, capture: await pcmCapture(blob) } : null;
          }),
        );
        if (disposed || epoch !== owner.current) return;
        const entries = restored.filter((row) => row !== null);
        raw.current = new Map(
          entries.map((row) => [row.index, row.capture.blob]),
        );
        setRecorded([...raw.current.keys()]);
        setFiles(
          Object.fromEntries(entries.map((row) => [row.index, row.capture])),
        );
        setError(null);
      } catch (reason) {
        if (!disposed)
          setError(
            reason instanceof Error
              ? reason.message
              : "녹음 복구 상태를 확인하지 못했어요.",
          );
      } finally {
        if (!disposed) setReady(true);
      }
    })();
    return () => {
      disposed = true;
      owner.current++;
    };
  }, [identity, scope, options.ready, options.resume]);
  const allCaptured =
    items.length > 0 &&
    items.every(
      (_, index) => Boolean(admissions[index]) || recorded.includes(index),
    );
  return {
    recoveryScope,
    recorder,
    files,
    ready,
    error,
    saving: saving > 0,
    allCaptured,
    hasFailedSave: failedSave != null,
    recordedCount: items.filter(
      (_, index) => Boolean(admissions[index]) || recorded.includes(index),
    ).length,
    nextIndex: items.findIndex(
      (_, index) => !admissions[index] && !recorded.includes(index),
    ),
    start: () => {
      if (ready && !error) {
        const index = next();
        if (index != null) void recorder.start(index);
      }
    },
    /** Drop one sentence's local audio so the next start records it again. */
    retake: (index: number) => {
      if (!run.current) return;
      raw.current.delete(index);
      failures.current.delete(index);
      setRecorded([...raw.current.keys()]);
      setFiles((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
      void sentenceRecordings.remove(storageKey(index)).catch(() => {});
    },
    retrySave: () => {
      if (failedSave != null) {
        const blob = raw.current.get(failedSave);
        if (blob) save(failedSave, blob);
      }
    },
    cleanup: async () => {
      await Promise.allSettled([...pending.current]);
      await Promise.all(
        items.map((_, index) => sentenceRecordings.remove(storageKey(index))),
      );
      localStorage.removeItem(scope);
    },
  };
}
