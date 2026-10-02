"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type Id, type PracticeContent } from "@/lib/api";
import { getAuthSessionVersion } from "@/lib/api/client";
import { canonicalApi, canonicalDatabaseId } from "@/lib/api/canonical";
import {
  canonicalAttemptKey,
  type CanonicalAnalysisView as View,
  type CanonicalViewIdentity,
} from "@/lib/canonical-analysis";
import { AnalysisWaitTimeout } from "@/lib/analysis-polling";
import {
  prepareAudioForAnalysis,
  useAudioRecorder,
} from "@/hooks/use-audio-recorder";
import { CanonicalAnalysisView } from "./canonical-analysis-view";
import { ReferencePlayer } from "./reference-player";

type Task = { signal: AbortSignal; check: () => void };
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 1000);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
function identity(view: View): CanonicalViewIdentity {
  return {
    analysisId: view.analysisId,
    recordingId: view.recordingId,
    requestId: view.requestId,
    executionId: view.executionId,
  };
}

/** Separate standalone audio lane. No course/title completion, implicit retry or persistent evidence cache. */
export function CanonicalPracticeSession({
  content,
  initialSessionId,
  onTitleChange,
}: {
  content: PracticeContent;
  initialSessionId?: Id;
  onTitleChange?: (title: string) => void;
}) {
  const recorder = useAudioRecorder();
  const session = useRef<Id | null>(initialSessionId ?? null);
  const task = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const rerecordFrom = useRef<CanonicalViewIdentity | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [recordingAllowed, setRecordingAllowed] = useState(!initialSessionId);
  const [completed, setCompleted] = useState(false);
  const [hasSession, setHasSession] = useState(!!initialSessionId);
  const [unsubmittedRecording, setUnsubmittedRecording] = useState<Id | null>(
    null,
  );

  async function run(operation: (context: Task) => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    task.current?.abort();
    const controller = new AbortController();
    task.current = controller;
    const epoch = getAuthSessionVersion();
    const check = () => {
      if (
        controller.signal.aborted ||
        task.current !== controller ||
        epoch !== getAuthSessionVersion()
      )
        throw new DOMException("Aborted", "AbortError");
    };
    setBusy(true);
    setError(null);
    setNotice(null);
    setView(null);
    setUnsubmittedRecording(null);
    try {
      await operation({ signal: controller.signal, check });
    } catch (failure) {
      if (
        !controller.signal.aborted &&
        task.current === controller &&
        epoch === getAuthSessionVersion()
      ) {
        setView(null);
        setError(
          failure instanceof Error
            ? failure.message
            : "분석 상태를 확인하지 못했습니다.",
        );
      }
    } finally {
      if (task.current === controller) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  async function currentSession(context: Task) {
    if (session.current == null) throw new Error("학습 세션이 없습니다.");
    const current = await api.training.get(session.current);
    context.check();
    if (String(current.content?.id ?? current.contentId) !== String(content.id))
      throw new Error("현재 콘텐츠와 학습 세션이 다릅니다.");
    return session.current;
  }

  async function poll(analysisId: Id, recordingId: Id, context: Task) {
    const until = Date.now() + 600_000;
    let expected: Partial<CanonicalViewIdentity> & { analysisId: number } = {
      analysisId: canonicalDatabaseId(analysisId),
      recordingId: canonicalDatabaseId(recordingId),
    };
    while (true) {
      context.check();
      const next = await canonicalApi.get(expected, context.signal);
      context.check();
      expected = identity(next);
      setView(next);
      setRecordingAllowed(false);
      if (next.jobStatus === "COMPLETED" || next.jobStatus === "FAILED") return;
      if (Date.now() >= until) throw new AnalysisWaitTimeout();
      await pause(context.signal);
    }
  }

  async function refresh(context: Task) {
    const id = await currentSession(context);
    const recordings = await api.training.listRecordings(id);
    context.check();
    const selected = recordings.find((item) => item.selected);
    const recordingId = selected?.recordingId ?? selected?.id;
    if (recordingId == null)
      throw new Error("선택한 녹음을 확인할 수 없습니다.");
    const state = await canonicalApi
      .status(id, context.signal)
      .catch((failure: unknown) => {
        if (
          failure instanceof ApiError &&
          failure.status === 404 &&
          failure.code === "ANALYSIS_NOT_FOUND"
        )
          return null;
        throw failure;
      });
    context.check();
    if (!state) {
      if (selected?.qualityStatus !== "PASS")
        throw new Error("선택 녹음의 품질 검사가 완료되지 않았습니다.");
      setRecordingAllowed(false);
      setUnsubmittedRecording(recordingId);
      setNotice(
        "현재 선택 녹음에는 분석 요청이 없습니다. 동의 후 명시적으로 v4 분석을 요청할 수 있습니다.",
      );
      return;
    }
    // Even FAILED is read, never converted to an exception before its canonical view.
    await poll(state.analysisId, recordingId, context);
  }

  useEffect(() => {
    onTitleChange?.("근거 기반 발음 분석");
    if (initialSessionId != null) void run(refresh);
    return () => {
      task.current?.abort();
      task.current = null;
      busyRef.current = false;
    };
    // Parent keys this component by content, route and auth-session generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function consent(context: Task) {
    if (!consented) throw new Error("음성 처리 안내에 동의해 주세요.");
    const capabilities = await api.training.getAnalysisCapabilities();
    context.check();
    if (
      capabilities.analysisRequests !== "CONFIGURED" ||
      !capabilities.consentPolicyRevision
    )
      throw new Error("분석 기능 또는 동의 정책을 확인할 수 없습니다.");
    return {
      accepted: true as const,
      policyRevision: capabilities.consentPolicyRevision,
    };
  }

  async function submitSelected(context: Task, recordingId: Id) {
    const id = await currentSession(context);
    const body = await consent(context);
    const recordings = await api.training.listRecordings(id);
    context.check();
    if (
      !recordings.some(
        (item) =>
          item.selected &&
          item.qualityStatus === "PASS" &&
          String(item.recordingId ?? item.id) === String(recordingId),
      )
    )
      throw new Error(
        "선택 녹음이 변경되었습니다. 현재 분석을 다시 조회해 주세요.",
      );
    // Reconcile a lost response first. Never turn a read error into a new job.
    const state = await canonicalApi
      .status(id, context.signal)
      .catch((failure: unknown) => {
        if (
          failure instanceof ApiError &&
          failure.status === 404 &&
          failure.code === "ANALYSIS_NOT_FOUND"
        )
          return null;
        throw failure;
      });
    context.check();
    if (state) {
      await poll(state.analysisId, recordingId, context);
      return;
    }
    const requested = await canonicalApi.analyze(id, body, context.signal);
    context.check();
    await poll(requested.analysisId, recordingId, context);
  }

  async function analyze(context: Task) {
    if (!recordingAllowed || !recorder.blob || !consented)
      throw new Error("녹음과 음성 처리 동의를 확인해 주세요.");
    const capabilities = await api.training.getAnalysisCapabilities();
    context.check();
    if (
      capabilities.recordingUpload !== "CONFIGURED" ||
      capabilities.analysisRequests !== "CONFIGURED" ||
      !capabilities.supportedLearningFocuses.includes("PRONUNCIATION") ||
      !capabilities.consentPolicyRevision
    )
      throw new Error("현재 서버에서 음성 분석을 준비하지 못했습니다.");
    if (
      recorder.durationMs < capabilities.minimumDurationMs ||
      recorder.durationMs > capabilities.maximumDurationMs
    )
      throw new Error(
        `녹음 길이는 ${capabilities.minimumDurationMs / 1000}~${capabilities.maximumDurationMs / 1000}초여야 합니다.`,
      );
    const prepared = await prepareAudioForAnalysis(
      recorder.blob,
      capabilities.acceptedAudioMimeTypes,
    );
    context.check();
    if (prepared.blob.size > capabilities.maximumAudioUploadBytes)
      throw new Error("녹음 파일이 업로드 제한을 초과했습니다.");
    if (rerecordFrom.current) {
      const fresh = await canonicalApi.get(
        rerecordFrom.current,
        context.signal,
      );
      context.check();
      if (!fresh.actions.canRerecord)
        throw new Error(
          "현재 시도에서 새 녹음을 허용하지 않습니다. 상태를 다시 확인해 주세요.",
        );
    }
    if (session.current == null) {
      const created = await api.training.create({
        contentId: content.id,
        courseStepId: null,
        titleExamId: null,
        learningFocus: "PRONUNCIATION",
      });
      context.check();
      session.current = created.sessionId ?? created.id ?? null;
      if (session.current == null) throw new Error("학습 세션 ID가 없습니다.");
      setHasSession(true);
    }
    const id = await currentSession(context);
    const upload = await api.training.getUploadUrl(id, {
      fileName: `recording-${Date.now()}.${prepared.extension}`,
      mimeType: prepared.mimeType,
      fileSizeBytes: prepared.blob.size,
    });
    context.check();
    await api.training.uploadRecording(upload, prepared.blob);
    context.check();
    const registered = await api.training.registerRecording(id, {
      objectKey: upload.objectKey,
      mimeType: prepared.mimeType,
      fileSizeBytes: prepared.blob.size,
      durationMs: recorder.durationMs,
    });
    context.check();
    const recordingId = registered.recordingId ?? registered.id;
    if (recordingId == null) throw new Error("녹음 ID가 없습니다.");
    let qualityReady = false;
    for (let count = 0; count < 30; count++) {
      const recordings = await api.training.listRecordings(id);
      context.check();
      const found = recordings.find(
        (item) => String(item.recordingId ?? item.id) === String(recordingId),
      );
      if (found?.qualityStatus === "PASS") {
        qualityReady = true;
        break;
      }
      if (found && found.qualityStatus !== "PENDING")
        throw new Error(
          "음질 검사를 통과하지 못했습니다. 녹음 입력을 확인해 주세요.",
        );
      await pause(context.signal);
    }
    if (!qualityReady) throw new Error("음질 검사 처리가 지연되고 있습니다.");
    await api.training.selectRecording(id, recordingId);
    context.check();
    rerecordFrom.current = null;
    setRecordingAllowed(false); // A lost POST response is reconciled with GET, not replayed.
    const requested = await canonicalApi.analyze(
      id,
      { accepted: true, policyRevision: capabilities.consentPolicyRevision },
      context.signal,
    );
    context.check();
    await poll(requested.analysisId, recordingId, context);
  }

  function action(kind: "retry" | "rerecord" | "complete") {
    const previous = view;
    if (!previous) return;
    void run(async (context) => {
      const id = await currentSession(context);
      const fresh = await canonicalApi.get(identity(previous), context.signal);
      context.check();
      if (canonicalAttemptKey(fresh) !== canonicalAttemptKey(previous))
        throw new Error("분석 시도가 변경됐습니다.");
      const allowed = {
        retry: fresh.actions.canRetry,
        rerecord: fresh.actions.canRerecord,
        complete: fresh.actions.canComplete,
      }[kind];
      if (!allowed)
        throw new Error("현재 서버 상태에서 이 작업을 허용하지 않습니다.");
      if (kind === "rerecord") {
        rerecordFrom.current = identity(fresh);
        recorder.reset();
        setCompleted(false);
        setRecordingAllowed(true);
        setNotice(
          "새 녹음은 별도 시도로 분석합니다. 이전 근거는 덮어쓰지 않습니다.",
        );
        return;
      }
      if (kind === "retry") {
        const body = await consent(context);
        context.check();
        const requested = await canonicalApi.retry(id, body, context.signal);
        context.check();
        await poll(requested.analysisId, fresh.recordingId, context);
        return;
      }
      const recordings = await api.training.listRecordings(id);
      context.check();
      const selected = recordings.find(
        (item) =>
          item.selected &&
          String(item.recordingId ?? item.id) === String(fresh.recordingId),
      );
      if (!selected) throw new Error("선택한 녹음이 변경됐습니다.");
      if (
        selected.durationMs == null ||
        !Number.isFinite(selected.durationMs) ||
        selected.durationMs <= 0
      )
        throw new Error("녹음 길이를 확인할 수 없어 완료하지 않았습니다.");
      await api.training.complete(
        id,
        Math.max(1, Math.round(selected.durationMs / 1000)),
      );
      context.check();
      setCompleted(true);
      setNotice("학습 절차를 완료했습니다. 점수나 발음 합격 판정은 아닙니다.");
      const updated = await canonicalApi.get(identity(fresh), context.signal);
      context.check();
      setView(updated);
    });
  }

  return (
    <div className="space-y-4 px-5 pb-8">
      <section className="design-card space-y-3">
        <h2 className="text-lg font-bold">
          근거 기반 발음 분석 · canonical v4
        </h2>
        <p className="text-sm">
          단독 음성 발음 연습입니다. 영상·억양 교정·시험 점수는 제공하지
          않습니다.
        </p>
        <p className="whitespace-pre-wrap leading-7">{content.scriptText}</p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consented}
            disabled={busy}
            onChange={(event) => setConsented(event.target.checked)}
          />
          분석 요청·재시도 시 녹음이 서버로 전송되어 음성 처리되는 것에
          동의합니다.
        </label>
        {recordingAllowed && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy || recorder.status === "requesting"}
              className="design-action"
              onClick={() => {
                if (recorder.status === "recording") recorder.stop();
                else
                  void recorder
                    .start()
                    .catch(() => setError("마이크를 시작하지 못했습니다."));
              }}
            >
              {recorder.status === "recording" ? "녹음 종료" : "새로 녹음"}
            </button>
            {recorder.error && <p role="alert">{recorder.error}</p>}
            <button
              type="button"
              className="design-action"
              disabled={busy || recorder.status !== "recorded" || !consented}
              onClick={() => void run(analyze)}
            >
              v4 분석 요청
            </button>
          </div>
        )}
        {recorder.previewUrl && (
          <ReferencePlayer
            source={recorder.previewUrl}
            title="이번 녹음 전체 듣기"
          />
        )}
      </section>
      {busy && (
        <p role="status">
          처리 상태를 확인하고 있습니다. 분석을 중복 요청하지 마세요.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {unsubmittedRecording != null && (
        <button
          type="button"
          className="design-action"
          disabled={busy || !consented}
          onClick={() =>
            void run((context) => submitSelected(context, unsubmittedRecording))
          }
        >
          선택 녹음으로 v4 분석 요청
        </button>
      )}
      {hasSession && (
        <button
          type="button"
          className="underline"
          disabled={busy}
          onClick={() => void run(refresh)}
        >
          현재 분석 다시 조회 (새 분석 요청 아님)
        </button>
      )}
      {hasSession && session.current != null && !busy && !recordingAllowed && (
        <p className="text-sm">
          <a
            className="underline"
            href={`/practice/${encodeURIComponent(String(content.id))}?sessionId=${encodeURIComponent(String(session.current))}&resumeType=ANALYSIS_STATUS&analysisMode=canonical`}
          >
            이 분석 이어가기 주소 열기
          </a>
        </p>
      )}
      {view && (
        <>
          <CanonicalAnalysisView data={view} currentIdentity={identity(view)} />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || !consented || !view.actions.canRetry}
              onClick={() => action("retry")}
            >
              분석 재시도
            </button>
            <button
              type="button"
              disabled={busy || !view.actions.canRerecord}
              onClick={() => action("rerecord")}
            >
              새 녹음으로 진행
            </button>
            <button
              type="button"
              disabled={busy || completed || !view.actions.canComplete}
              onClick={() => action("complete")}
            >
              학습 절차 완료
            </button>
          </div>
        </>
      )}
    </div>
  );
}
