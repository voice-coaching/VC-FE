"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { prepareDirectAudio } from "@/lib/direct-audio";
import { sentenceHistoryLinks } from "@/lib/sentence-history-links";
import { sentenceRecordings } from "@/lib/sentence-recordings";
import {
  createSentenceBatch,
  readSentenceBatch,
  uploadBatchSentence,
  cancelSentenceBatch,
  sha256,
  type SentenceBatch,
} from "@/lib/sentence-batch-api";

const savedSchema = z.object({
  batchId: z.string().uuid(),
  historyClaim: z.string().min(1),
  sentences: z.array(z.string()).min(1).max(50),
});
type Saved = z.infer<typeof savedSchema>;

/** Local capture never depends on admission acknowledgements or inference completion. */
export function useSentenceBatch(
  contentId: string | number,
  sentences: string[],
) {
  const key = `sentence-batch:v1:${getAuthenticatedUserId()}:${contentId}`;
  const scripts = JSON.stringify(sentences);
  const [view, setView] = useState<SentenceBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState("PENDING");
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [captured, setCaptured] = useState<number[]>([]);
  const [hasAttempt, setHasAttempt] = useState(false);
  const [pollEpoch, setPollEpoch] = useState(0);
  const [retryIndex, setRetryIndex] = useState<number | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const writes = useRef(new Set<Promise<void>>());
  const saved = useRef<Saved | null>(null);
  const latestView = useRef<SentenceBatch | null>(null);
  const files = useRef(new Map<number, Blob>());
  const pumpBusy = useRef(false),
    resetting = useRef(false);
  const running = useRef<Promise<void> | null>(null);
  const pumpRef = useRef<() => void>(() => undefined);
  const controller = useRef(new AbortController());
  const recordingKey = useCallback(
    (batchId: string, index: number) => `${key}:${batchId}:${index}`,
    [key],
  );
  const apply = useCallback(
    (next: SentenceBatch) => {
      if (
        JSON.stringify(next.sentences.map((row) => row.scriptText)) !== scripts
      )
        throw new Error("SENTENCE_LIST_MISMATCH");
      const previous = latestView.current;
      if (
        previous?.batchId === next.batchId &&
        (previous.uploadedCount > next.uploadedCount ||
          previous.completedCount > next.completedCount ||
          (["RESULT_READY", "CANCELLED"].includes(previous.status) &&
            previous.status !== next.status))
      )
        return;
      latestView.current = next;
      setView(next);
    },
    [scripts],
  );
  function captureError(reason: unknown) {
    setError(
      reason instanceof Error
        ? reason.message
        : "문장 전송 상태를 확인하지 못했어요.",
    );
  }
  function identity(): Saved {
    if (
      !sentences.length ||
      sentences.length > 50 ||
      sentences.join("").length > 4000
    )
      throw new Error("한 연습은 1~50문장, 총 4000자까지 지원해요.");
    if (!saved.current) {
      const value = {
        batchId: crypto.randomUUID(),
        historyClaim: crypto.randomUUID() + crypto.randomUUID(),
        sentences,
      };
      localStorage.setItem(key, JSON.stringify(value));
      saved.current = value;
      setHasAttempt(true);
    }
    if (JSON.stringify(saved.current.sentences) !== scripts)
      throw new Error("이전 원고의 연습을 종료한 뒤 새로 시작해 주세요.");
    return saved.current;
  }
  async function ensure(
    value: Saved,
    signal: AbortSignal,
  ): Promise<SentenceBatch> {
    return createSentenceBatch(
      value.batchId,
      value.sentences,
      Number(contentId) || null,
      await sha256(value.historyClaim),
      signal,
    );
  }
  function nextLocal(): number | null {
    const index = sentences.findIndex(
      (_, i) =>
        !files.current.has(i) && !latestView.current?.sentences[i]?.jobId,
    );
    return index < 0 ? null : index;
  }
  function pump(): void {
    if (
      pumpBusy.current ||
      resetting.current ||
      controller.current.signal.aborted ||
      !saved.current
    )
      return;
    pumpBusy.current = true;
    setUploading(true);
    const signal = controller.current.signal;
    const value = saved.current;
    running.current = (async () => {
      let currentIndex: number | null = null;
      try {
        const initial = await ensure(value, signal);
        if (signal.aborted) return;
        apply(initial);
        for (;;) {
          const entry = [...files.current.entries()]
            .sort(([a], [b]) => a - b)
            .find(([i]) => !latestView.current?.sentences[i]?.jobId);
          if (!entry) break;
          const [index, source] = entry;
          currentIndex = index;
          const blobKey = recordingKey(value.batchId, index);
          // Save exact source bytes before conversion; later capture proceeds independently.
          await sentenceRecordings.put(blobKey + ":raw", source);
          if (signal.aborted) return;
          let prepared = await sentenceRecordings.read(blobKey);
          if (!prepared) {
            prepared = (await prepareDirectAudio(source)).blob;
            if (signal.aborted) return;
            await sentenceRecordings.put(blobKey, prepared);
          }
          if (signal.aborted) return;
          const next = await uploadBatchSentence(
            value.batchId,
            index,
            prepared,
            signal,
          );
          if (signal.aborted) return;
          apply(next);
          setRetryIndex(null);
          setError(null);
        }
      } catch (reason) {
        if (!signal.aborted) {
          setRetryIndex(currentIndex);
          captureError(reason);
        }
      } finally {
        pumpBusy.current = false;
        if (!signal.aborted) setUploading(false);
        else if (
          !resetting.current &&
          !controller.current.signal.aborted &&
          controller.current.signal !== signal
        ) {
          // A React lifecycle restart may have restored the queue before this
          // previous request observed cancellation. Resume with the live signal.
          queueMicrotask(() => pumpRef.current());
        }
      }
    })();
  }
  pumpRef.current = pump;

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    void (async () => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const value = savedSchema.parse(JSON.parse(raw));
        saved.current = value;
        setHasAttempt(true);
        if (JSON.stringify(value.sentences) !== scripts)
          throw new Error(
            "이전 원고의 연습이 남아 있어요. 새 연습을 시작해 주세요.",
          );
        const restored = await Promise.all(
          value.sentences.map(async (_, index) => {
            const id = recordingKey(value.batchId, index);
            const blob =
              (await sentenceRecordings.read(id + ":raw")) ??
              (await sentenceRecordings.read(id));
            return blob ? ([index, blob] as const) : null;
          }),
        );
        if (current.signal.aborted) return;
        files.current = new Map(restored.filter((row) => row !== null));
        setCaptured([...files.current.keys()]);
        // Only local recovery controls the microphone. HTTP reconciliation is background work.
        pumpRef.current();
      } catch (reason) {
        if (!current.signal.aborted) captureError(reason);
      } finally {
        if (!current.signal.aborted) setLoading(false);
      }
    })();
    return () => current.abort();
  }, [key, scripts, recordingKey]);

  function begin(): number | null {
    if (loading || resetting.current) return null;
    try {
      identity();
      return nextLocal();
    } catch (reason) {
      captureError(reason);
      return null;
    }
  }
  function enqueue(index: number, blob: Blob): number | null {
    identity();
    files.current.set(index, blob);
    setCaptured([...files.current.keys()]);
    // Persist every captured file immediately, even while an earlier POST is still pending.
    const value = saved.current!;
    setSavingCount((count) => count + 1);
    const write = sentenceRecordings
      .put(recordingKey(value.batchId, index) + ":raw", blob)
      .catch((reason) => {
        if (!controller.current.signal.aborted) captureError(reason);
      })
      .finally(() => {
        writes.current.delete(write);
        setSavingCount((count) => count - 1);
      });
    writes.current.add(write);
    pumpRef.current();
    return nextLocal();
  }
  function refresh(): void {
    setError(null);
    setPollEpoch((value) => value + 1);
    pumpRef.current();
  }

  async function allowRetake(index: number): Promise<boolean> {
    if (pumpBusy.current || resetting.current) return false;
    try {
      const value = identity(),
        next = await ensure(value, controller.current.signal);
      apply(next);
      if (next.sentences[index]?.jobId) {
        pumpRef.current();
        return false;
      }
      const id = recordingKey(value.batchId, index);
      await sentenceRecordings.remove(id);
      await sentenceRecordings.remove(id + ":raw");
      files.current.delete(index);
      setCaptured([...files.current.keys()]);
      setRetryIndex(null);
      setError(null);
      return true;
    } catch (reason) {
      captureError(reason);
      return false;
    }
  }
  const localComplete =
    sentences.length > 0 &&
    sentences.every(
      (_, i) => captured.includes(i) || Boolean(view?.sentences[i]?.jobId),
    );
  useEffect(() => {
    if (
      !localComplete ||
      !view ||
      ["RESULT_READY", "CANCELLED"].includes(view.status)
    )
      return;
    const current = new AbortController();
    void (async () => {
      try {
        while (!current.signal.aborted) {
          const next = await readSentenceBatch(
            view.batchId,
            current.signal,
            true,
          );
          if (current.signal.aborted) return;
          apply(next);
          if (["RESULT_READY", "CANCELLED"].includes(next.status)) return;
        }
      } catch (reason) {
        if (!current.signal.aborted) captureError(reason);
      }
    })();
    return () => current.abort();
  }, [
    localComplete,
    view?.batchId,
    view?.status === "RESULT_READY",
    view?.status === "CANCELLED",
    pollEpoch,
    apply,
  ]);
  useEffect(() => {
    const current = new AbortController();
    const links = sentenceHistoryLinks(String(getAuthenticatedUserId()));
    const jobs =
      view?.status === "RESULT_READY"
        ? (view.results
            ?.filter((row) => row.analysis.result)
            .map((row) => row.analysis.jobId) ?? [])
        : [];
    let timer: ReturnType<typeof setTimeout>;
    try {
      if (jobs.length && saved.current)
        links.enqueue(jobs, saved.current.historyClaim);
    } catch {
      setError(
        "이력 연결 정보를 이 기기에 보관하지 못했어요. 연습을 닫기 전에 저장 공간을 확인해 주세요.",
      );
      setHistory("RETRYING");
      return () => current.abort();
    }
    async function sync() {
      try {
        await links.flush(current.signal);
        if (current.signal.aborted) return;
        setHistory(links.status(jobs));
      } catch {
        if (!current.signal.aborted) setHistory("RETRYING");
      }
      if (!current.signal.aborted) timer = setTimeout(() => void sync(), 5000);
    }
    void sync();
    return () => {
      current.abort();
      clearTimeout(timer);
    };
  }, [view?.status, view?.batchId, key]);

  useEffect(() => {
    if (view?.status !== "RESULT_READY") return;
    let disposed = false;
    const created: string[] = [];
    void Promise.all(
      view.sentences.map(async (_, index) => {
        const blob = await sentenceRecordings.read(
          recordingKey(view.batchId, index),
        );
        if (!blob || disposed) return null;
        const expected =
          view.results?.[index]?.analysis.result?.sourceIdentity.audioSha256;
        if (expected) {
          const digest = await crypto.subtle.digest(
            "SHA-256",
            await blob.arrayBuffer(),
          );
          const actual = Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          if (actual !== expected || disposed) return null;
        }
        const url = URL.createObjectURL(blob);
        created.push(url);
        return [index, url] as const;
      }),
    )
      .then((rows) => {
        if (!disposed)
          setUrls(Object.fromEntries(rows.filter((row) => row !== null)));
      })
      .catch(() => {
        /* Server results remain usable if local recordings are unavailable. */
      });
    return () => {
      disposed = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [view?.status, view?.batchId, recordingKey]);

  async function reset(): Promise<boolean> {
    if (resetting.current) return false;
    resetting.current = true;
    controller.current.abort();
    try {
      await running.current;
      await Promise.allSettled([...writes.current]);
      controller.current = new AbortController();
      const value = saved.current;
      if (value) {
        if (view?.status === "RESULT_READY")
          sentenceHistoryLinks(String(getAuthenticatedUserId())).enqueue(
            view.results
              ?.filter((row) => row.analysis.result)
              .map((row) => row.analysis.jobId) ?? [],
            value.historyClaim,
          );
        await ensure(value, controller.current.signal);
        await cancelSentenceBatch(value.batchId, controller.current.signal);
        await Promise.all(
          value.sentences.map(async (_, index) => {
            const id = recordingKey(value.batchId, index);
            await sentenceRecordings.remove(id);
            await sentenceRecordings.remove(id + ":raw");
          }),
        );
      }
      localStorage.removeItem(key);
      saved.current = null;
      latestView.current = null;
      files.current.clear();
      setHasAttempt(false);
      setView(null);
      setCaptured([]);
      setRetryIndex(null);
      setError(null);
      setHistory("PENDING");
      setUrls({});
      setUploading(false);
      return true;
    } catch (reason) {
      captureError(reason);
      return false;
    } finally {
      resetting.current = false;
      setUploading(false);
    }
  }
  return {
    view,
    error,
    loading,
    uploading,
    history,
    urls,
    hasAttempt,
    retryIndex,
    localComplete,
    savingRecordings: savingCount > 0,
    capturedCount: sentences.filter(
      (_, i) => captured.includes(i) || view?.sentences[i]?.jobId,
    ).length,
    nextIndex: sentences.findIndex(
      (_, i) => !captured.includes(i) && !view?.sentences[i]?.jobId,
    ),
    begin,
    enqueue,
    refresh,
    reset,
    allowRetake,
  };
}
