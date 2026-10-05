"use client";
import { useEffect, useRef, useState } from "react";
import {
  useAudioRecorder,
  prepareAudioForAnalysis,
} from "@/hooks/use-audio-recorder";
import type { PracticeContent } from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import {
  submitDirect,
  observeDirect,
  findDirect,
  linkDirectHistory,
  cancelDirect,
  type DirectView,
} from "@/lib/direct-analysis";
import { DirectAnalysisResult } from "./direct-analysis-result";

type Attempt = { attemptId: string; jobId?: string; historyClaim?: string };
export function DirectPracticeSession({
  content,
}: {
  content: PracticeContent;
}) {
  const recorder = useAudioRecorder();
  const [view, setView] = useState<DirectView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState("PENDING");
  const controller = useRef<AbortController | null>(null);
  const attempt = useRef<Attempt | null>(null);
  const key = `direct-analysis:${getAuthenticatedUserId()}:${content.id}`;
  function save(value: Attempt) {
    attempt.current = value;
    localStorage.setItem(key, JSON.stringify(value));
  }
  function update(next: DirectView) {
    setView(next);
    if (!["RUNNING", "QUEUED"].includes(next.status)) setBusy(false);
  }
  async function observe(jobId: string, signal: AbortSignal) {
    setBusy(true);
    try {
      await observeDirect(jobId, signal, update);
    } catch (e) {
      if (!signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "결과 연결이 끊겼습니다. 다시 확인해 주세요.",
        );
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved: Attempt = JSON.parse(raw);
        attempt.current = saved;
        if (saved.jobId) void observe(saved.jobId, current.signal);
        else
          void findDirect(saved.attemptId, current.signal)
            .then((reply) => {
              if (current.signal.aborted) return;
              save({ ...saved, jobId: reply.jobId });
              update(reply);
              void observe(reply.jobId, current.signal);
            })
            .catch(() => {
              if (!current.signal.aborted)
                setError(
                  "이전 요청 접수를 확인하지 못했습니다. 새 녹음 전 결과를 다시 확인해 주세요.",
                );
            });
      }
    } catch {
      setError("이전 작업 정보를 복구하지 못했습니다.");
    }
    return () => current.abort();
    // Key owns this component's user/content identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (view?.status !== "RESULT_READY" || !attempt.current?.historyClaim)
      return;
    const current = new AbortController();
    const saved = attempt.current;
    let timer: ReturnType<typeof setTimeout>;
    async function sync() {
      try {
        const result = await linkDirectHistory(
          view!.jobId,
          saved.historyClaim!,
          current.signal,
        );
        if (current.signal.aborted) return;
        setHistory(result.state);
        if (["SAVED", "CONFLICT"].includes(result.state)) return;
      } catch {
        if (current.signal.aborted) return;
        setHistory("RETRYING");
      }
      timer = setTimeout(() => void sync(), 5000);
    }
    void sync();
    return () => {
      current.abort();
      clearTimeout(timer);
    };
  }, [view?.jobId, view?.status]);
  async function submit() {
    if (!recorder.blob || busy) return;
    setBusy(true);
    setError(null);
    const current = new AbortController();
    controller.current?.abort();
    controller.current = current;
    try {
      const prepared = await prepareAudioForAnalysis(recorder.blob, [
        "audio/wav",
      ]);
      const selected = attempt.current ?? {
        attemptId: crypto.randomUUID(),
        historyClaim: btoa(
          Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
            String.fromCharCode(b),
          ).join(""),
        )
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replace(/=+$/, ""),
      };
      save(selected);
      if (!selected.historyClaim)
        throw new Error("이력 연결 정보를 확인하지 못했습니다.");
      const reply = await submitDirect(
        prepared.blob,
        content.scriptText,
        Number(content.id) || null,
        selected.attemptId,
        selected.historyClaim,
        current.signal,
      );
      if (current.signal.aborted) return;
      save({ ...selected, jobId: reply.jobId });
      update(reply);
      await observe(reply.jobId, current.signal);
    } catch (e) {
      if (!current.signal.aborted) {
        setError(e instanceof Error ? e.message : "분석 요청에 실패했습니다.");
        setBusy(false);
      }
    }
  }
  async function newRecording() {
    controller.current?.abort();
    attempt.current = null;
    localStorage.removeItem(key);
    setView(null);
    setError(null);
    setHistory("PENDING");
    recorder.reset();
    await recorder.start();
  }
  async function recover() {
    if (!attempt.current) return;
    const current = new AbortController();
    controller.current?.abort();
    controller.current = current;
    setError(null);
    setBusy(true);
    try {
      const reply = await findDirect(attempt.current.attemptId, current.signal);
      if (current.signal.aborted) return;
      save({ ...attempt.current, jobId: reply.jobId });
      update(reply);
      await observe(reply.jobId, current.signal);
    } catch {
      if (!current.signal.aborted)
        setError(
          "접수된 분석을 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.",
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold">{content.title}</h1>
      <p className="whitespace-pre-wrap">{content.scriptText}</p>
      {recorder.previewUrl && (
        <audio controls src={recorder.previewUrl} className="w-full" />
      )}
      {!busy && recorder.status !== "recording" && (
        <button
          className="rounded-xl bg-primary p-3 text-white"
          onClick={() => void newRecording()}
        >
          새로 녹음하기
        </button>
      )}
      {recorder.status === "recording" && (
        <button onClick={() => recorder.stop()}>
          녹음 종료 ({Math.floor(recorder.elapsedMs / 1000)}초)
        </button>
      )}
      {recorder.blob && !view && (
        <button
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-xl border p-3"
        >
          {busy ? "분석 중…" : "분석하기 / 같은 요청 다시 확인"}
        </button>
      )}
      {busy && <p role="status">음성을 분석하고 있습니다.</p>}
      {!view && !busy && attempt.current && (
        <button onClick={() => void recover()}>이전 요청 결과 확인</button>
      )}
      {view?.jobId &&
        !["RESULT_READY", "FAILED", "CANCELLED"].includes(view.status) && (
          <>
            <button
              onClick={() => {
                const c = new AbortController();
                controller.current?.abort();
                controller.current = c;
                void observe(view.jobId, c.signal);
              }}
            >
              결과 다시 확인
            </button>
            <button
              onClick={() =>
                void cancelDirect(view.jobId)
                  .then(update)
                  .catch(() => setError("취소 여부를 확인하지 못했습니다."))
              }
            >
              분석 취소
            </button>
          </>
        )}
      {(error || recorder.error) && (
        <p role="alert">{error || recorder.error}</p>
      )}
      {view?.status === "FAILED" && (
        <p role="alert">
          분석을 완료하지 못했습니다. 새 녹음으로 다시 시도해 주세요.
        </p>
      )}
      {view?.result && (
        <>
          <DirectAnalysisResult result={view.result} />
          <p role="status">
            {history === "SAVED"
              ? "학습 이력 저장 완료"
              : history === "CONFLICT"
                ? "이력을 연결하지 못했습니다."
                : "결과가 준비됐습니다. 학습 이력을 저장하고 있습니다."}
          </p>
          <a href="/mypage/history">학습 이력 보기</a>
        </>
      )}
    </div>
  );
}
