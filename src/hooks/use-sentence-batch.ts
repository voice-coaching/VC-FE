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

/** Coordinate recording admission and result collection without waiting for each inference. */
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
  const [pendingRecording, setPendingRecording] = useState<Blob | null>(null);
  const [pollEpoch, setPollEpoch] = useState(0);
  const [hasAttempt, setHasAttempt] = useState(false);
  const saved = useRef<Saved | null>(null);
  const latestView = useRef<SentenceBatch | null>(null);
  const gate = useRef(false);
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
      latestView.current = next;
      setView(next);
    },
    [scripts],
  );
  const captureError = (reason: unknown) =>
    setError(
      reason instanceof Error
        ? reason.message
        : "문장 분석 상태를 확인하지 못했어요.",
    );

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setLoading(false);
        return () => current.abort();
      }
      const value = savedSchema.parse(JSON.parse(raw));
      saved.current = value;
      setHasAttempt(true);
      if (JSON.stringify(value.sentences) !== scripts)
        throw new Error(
          "이전 원고의 연습이 남아 있어요. 새 연습을 시작해 주세요.",
        );
      void sha256(value.historyClaim)
        .then((digest) =>
          createSentenceBatch(
            value.batchId,
            value.sentences,
            Number(contentId) || null,
            digest,
            current.signal,
          ),
        )
        .then((next) => {
          if (!current.signal.aborted) apply(next);
        })
        .catch((reason) => {
          if (!current.signal.aborted) captureError(reason);
        })
        .finally(() => {
          if (!current.signal.aborted) setLoading(false);
        });
    } catch (reason) {
      captureError(reason);
      setLoading(false);
    }
    return () => current.abort();
  }, [key, scripts, contentId, apply]);

  const ensure = async (): Promise<Saved> => {
    if (
      !sentences.length ||
      sentences.length > 50 ||
      sentences.join("").length > 4000
    )
      throw new Error("한 연습은 1~50문장, 총 4000자까지 녹음할 수 있어요.");
    let value = saved.current;
    if (!value) {
      value = {
        batchId: crypto.randomUUID(),
        historyClaim: crypto.randomUUID() + crypto.randomUUID(),
        sentences,
      };
      localStorage.setItem(key, JSON.stringify(value));
      saved.current = value;
      setHasAttempt(true);
    }
    if (JSON.stringify(value.sentences) !== scripts)
      throw new Error("이전 원고의 연습을 종료한 뒤 새로 시작해 주세요.");
    const next = await createSentenceBatch(
      value.batchId,
      value.sentences,
      Number(contentId) || null,
      await sha256(value.historyClaim),
      controller.current.signal,
    );
    apply(next);
    return value;
  };

  async function initialize(): Promise<number | null> {
    if (gate.current) return null;
    gate.current = true;
    setError(null);
    try {
      await ensure();
      return latestView.current?.sentences.findIndex((row) => !row.jobId) ?? 0;
    } catch (reason) {
      captureError(reason);
      return null;
    } finally {
      gate.current = false;
    }
  }

  async function send(index: number, source?: Blob): Promise<boolean> {
    if (gate.current) return false;
    gate.current = true;
    setUploading(true);
    setError(null);
    const current = controller.current;
    try {
      const value = await ensure();
      // Resolve an acknowledgement lost after admission before touching the bytes.
      const latest = await readSentenceBatch(value.batchId, current.signal);
      if (latest.sentences[index]?.jobId) {
        setPendingRecording(null);
        apply(latest);
        return true;
      }
      const blobKey = recordingKey(value.batchId, index);
      let prepared = await sentenceRecordings.read(blobKey);
      if (!prepared) {
        if (!source) throw new Error("이 문장을 다시 녹음해 주세요.");
        prepared = (await prepareDirectAudio(source)).blob;
        await sentenceRecordings.put(blobKey, prepared);
      }
      const next = await uploadBatchSentence(
        value.batchId,
        index,
        prepared,
        current.signal,
      );
      if (current.signal.aborted) return false;
      setPendingRecording(null);
      apply(next);
      return true;
    } catch (reason) {
      if (!current.signal.aborted) captureError(reason);
      return false;
    } finally {
      gate.current = false;
      if (!current.signal.aborted) setUploading(false);
    }
  }

  async function refresh(): Promise<void> {
    if (!saved.current) return;
    setError(null);
    setLoading(true);
    try {
      const value = await ensure();
      apply(await readSentenceBatch(value.batchId, controller.current.signal));
    } catch (reason) {
      captureError(reason);
    } finally {
      setLoading(false);
      setPollEpoch((current) => current + 1);
    }
  }

  async function discardPending(index: number): Promise<boolean> {
    if (gate.current) return false;
    gate.current = true;
    try {
      const value = await ensure();
      const latest = await readSentenceBatch(
        value.batchId,
        controller.current.signal,
      );
      apply(latest);
      if (!latest.sentences[index]?.jobId)
        await sentenceRecordings.remove(recordingKey(value.batchId, index));
      setPendingRecording(null);
      setError(null);
      return true;
    } catch (reason) {
      captureError(reason);
      return false;
    } finally {
      gate.current = false;
    }
  }

  const waiting = view?.status === "PROCESSING";
  useEffect(() => {
    if (!waiting || !view) return;
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
          if (next.status !== "PROCESSING") return;
        }
      } catch (reason) {
        if (!current.signal.aborted) captureError(reason);
      }
    })();
    return () => current.abort();
  }, [waiting, view?.batchId, apply, pollEpoch]);

  useEffect(() => {
    const index = view?.sentences.findIndex((row) => !row.jobId) ?? -1;
    if (!view || index < 0) {
      setPendingRecording(null);
      return;
    }
    let disposed = false;
    void sentenceRecordings
      .read(recordingKey(view.batchId, index))
      .then((blob) => {
        if (!disposed) setPendingRecording(blob ?? null);
      })
      .catch(() => {
        if (!disposed) setError("이 기기에 보관한 녹음을 읽지 못했어요.");
      });
    return () => {
      disposed = true;
    };
  }, [view?.batchId, view?.uploadedCount, recordingKey]);

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
    if (gate.current) return false;
    gate.current = true;
    try {
      const value = saved.current;
      if (value) {
        if (view?.status === "RESULT_READY")
          sentenceHistoryLinks(String(getAuthenticatedUserId())).enqueue(
            view.results
              ?.filter((row) => row.analysis.result)
              .map((row) => row.analysis.jobId) ?? [],
            value.historyClaim,
          );
        await createSentenceBatch(
          value.batchId,
          value.sentences,
          Number(contentId) || null,
          await sha256(value.historyClaim),
          controller.current.signal,
        );
        await cancelSentenceBatch(value.batchId, controller.current.signal);
        await Promise.all(
          value.sentences.map((_, index) =>
            sentenceRecordings.remove(recordingKey(value.batchId, index)),
          ),
        );
      }
      localStorage.removeItem(key);
      saved.current = null;
      latestView.current = null;
      setHasAttempt(false);
      setView(null);
      setError(null);
      setHistory("PENDING");
      setUrls({});
      setPendingRecording(null);
      return true;
    } catch (reason) {
      captureError(reason);
      return false;
    } finally {
      gate.current = false;
    }
  }
  return {
    view,
    error,
    loading,
    uploading,
    history,
    urls,
    pendingRecording,
    hasAttempt,
    initialize,
    send,
    refresh,
    reset,
    discardPending,
    nextIndex: view?.sentences.findIndex((row) => !row.jobId) ?? 0,
  };
}
