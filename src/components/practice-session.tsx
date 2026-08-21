"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Square, UploadCloud, Volume2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import {
  api,
  type AnalysisResult,
  type AnalysisSegment,
  type Id,
  type PracticeContent,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Phase =
  | "idle"
  | "recording"
  | "review"
  | "uploading"
  | "analyzing"
  | "result"
  | "error";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function PracticeSession({ content }: { content: PracticeContent }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumedSessionId = searchParams.get("sessionId");
  const resumeType = searchParams.get("resumeType");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<Id | null>(resumedSessionId);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [segments, setSegments] = useState<AnalysisSegment[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [canRetryAnalysis, setCanRetryAnalysis] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const resumeStarted = useRef(false);
  const sessionIdRef = useRef<Id | null>(resumedSessionId);
  const phaseRef = useRef<Phase>("idle");
  const completedRef = useRef(resumeType === "ANALYSIS_RESULT");
  const recorder = useAudioRecorder();

  const courseId = searchParams.get("courseId");
  const courseStepId = searchParams.get("courseStepId");
  const overall = analysis?.overallScore ?? 0;
  const selectedSegments = segments.filter(
    (segment) => segment.resultStatus !== "NORMAL",
  );

  useEffect(() => {
    phaseRef.current = phase;
    if (recorder.status === "recorded" && phase === "recording")
      setPhase("review");
    if (
      ["denied", "unsupported", "error"].includes(recorder.status) &&
      phase === "recording"
    ) {
      setPhase("error");
    }
  }, [phase, recorder.status]);

  useEffect(
    () => () => {
      const activeSessionId = sessionIdRef.current;
      if (
        activeSessionId &&
        !completedRef.current &&
        phaseRef.current !== "analyzing"
      ) {
        void api.training.cancel(activeSessionId).catch(() => undefined);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      resumeStarted.current ||
      !resumedSessionId ||
      !["ANALYSIS_STATUS", "ANALYSIS_RESULT"].includes(resumeType ?? "")
    )
      return;

    resumeStarted.current = true;
    let active = true;
    setPhase("analyzing");

    void (async () => {
      try {
        let analysisId: Id;
        if (resumeType === "ANALYSIS_RESULT") {
          analysisId = (await api.training.getSessionAnalysis(resumedSessionId))
            .analysisId;
        } else {
          for (let attempt = 0; attempt < 120; attempt += 1) {
            const status =
              await api.training.getAnalysisStatus(resumedSessionId);
            if (!active) return;
            setAnalysisProgress(status.progressPercent);
            if (status.status === "FAILED") {
              setCanRetryAnalysis(true);
              throw new Error(
                status.failureReason || "음성 분석에 실패했습니다.",
              );
            }
            if (status.status === "COMPLETED") {
              analysisId = status.analysisId;
              const [result, segmentPage] = await Promise.all([
                api.analyses.get(analysisId),
                api.analyses.getSegments(analysisId, { page: 0, size: 100 }),
              ]);
              if (!active) return;
              setAnalysis(result);
              setSegments(segmentPage.items);
              await api.training.complete(resumedSessionId, 1);
              completedRef.current = true;
              if (active) setPhase("result");
              return;
            }
            await wait(1_000);
          }
          throw new Error(
            "분석 대기 시간이 초과되었습니다. 학습 기록에서 다시 확인해 주세요.",
          );
        }

        const [result, segmentPage] = await Promise.all([
          api.analyses.get(analysisId),
          api.analyses.getSegments(analysisId, { page: 0, size: 100 }),
        ]);
        if (!active) return;
        setAnalysis(result);
        setSegments(segmentPage.items);
        setPhase("result");
      } catch (reason) {
        if (!active) return;
        setRequestError(
          reason instanceof Error
            ? reason.message
            : "이어하던 학습을 불러오지 못했습니다.",
        );
        setPhase("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [resumeType, resumedSessionId]);

  async function ensureSession() {
    if (sessionId) return sessionId;
    const session = await api.training.create({
      contentId: content.id,
      courseStepId: courseStepId || null,
      learningFocus: content.learningFocus,
    });
    const createdId = session.sessionId ?? session.id;
    if (createdId == null) throw new Error("학습 세션 ID가 응답에 없습니다.");
    setSessionId(createdId);
    sessionIdRef.current = createdId;
    return createdId;
  }

  async function startRecording() {
    setRequestError(null);
    try {
      await ensureSession();
      const started = await recorder.start();
      if (started) setPhase("recording");
      else setPhase("error");
    } catch (reason) {
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "학습 세션을 시작하지 못했습니다.",
      );
      setPhase("error");
    }
  }

  async function waitForAnalysis(activeSessionId: Id) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const status = await api.training.getAnalysisStatus(activeSessionId);
      setAnalysisProgress(status.progressPercent);
      if (status.status === "COMPLETED") return status.analysisId;
      if (status.status === "FAILED") {
        setCanRetryAnalysis(true);
        throw new Error(status.failureReason || "음성 분석에 실패했습니다.");
      }
      await wait(1_000);
    }
    throw new Error(
      "분석 대기 시간이 초과되었습니다. 잠시 후 학습 기록에서 확인해 주세요.",
    );
  }

  async function waitForRecordingQuality(activeSessionId: Id, recordingId: Id) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const recordings = await api.training.listRecordings(activeSessionId);
      const recording = recordings.find(
        (item) => String(item.recordingId ?? item.id) === String(recordingId),
      );
      if (recording?.qualityStatus === "PASS") return;
      if (recording && recording.qualityStatus !== "PENDING") {
        throw new Error(
          `음질 검사를 통과하지 못했습니다: ${recording.qualityStatus}`,
        );
      }
      await wait(1_000);
    }
    throw new Error(
      "음질 검사 대기 시간이 초과되었습니다. 다시 녹음해 주세요.",
    );
  }

  async function loadResult(activeSessionId: Id, analysisId: Id) {
    const [result, segmentPage] = await Promise.all([
      api.analyses.get(analysisId),
      api.analyses.getSegments(analysisId, { page: 0, size: 100 }),
    ]);
    setAnalysis(result);
    setSegments(segmentPage.items);
    await api.training.complete(
      activeSessionId,
      Math.max(1, Math.round(recorder.durationMs / 1_000)),
    );
    completedRef.current = true;

    if (courseId && courseStepId) {
      const steps = await api.courses.getSteps(courseId);
      const stepIndex = steps.findIndex(
        (step) => String(step.id) === courseStepId,
      );
      const progressPercent = Math.round(
        ((Math.max(0, stepIndex) + 1) / Math.max(1, steps.length)) * 100,
      );
      await api.courses.updateProgress(courseId, {
        lastStepId: courseStepId,
        progressPercent,
      });
      if (progressPercent >= 100) await api.courses.complete(courseId);
    }
    setPhase("result");
  }

  async function analyze() {
    if (!recorder.blob) return;
    if (recorder.durationMs < 1_000) {
      setRequestError("분석하려면 1초 이상 녹음해 주세요.");
      return;
    }
    setRequestError(null);
    setCanRetryAnalysis(false);
    setUploadProgress(0);
    try {
      const activeSessionId = await ensureSession();
      setPhase("uploading");
      const mimeType = recorder.blob.type || "audio/webm";
      const extension = mimeType.includes("mp4")
        ? "m4a"
        : mimeType.includes("ogg")
          ? "ogg"
          : "webm";
      const uploadInfo = await api.training.getUploadUrl(activeSessionId, {
        fileName: `recording-${Date.now()}.${extension}`,
        mimeType,
        fileSizeBytes: recorder.blob.size,
      });
      await api.training.uploadRecording(
        uploadInfo,
        recorder.blob,
        setUploadProgress,
      );
      const recording = await api.training.registerRecording(activeSessionId, {
        objectKey: uploadInfo.objectKey,
        mimeType,
        fileSizeBytes: recorder.blob.size,
        durationMs: recorder.durationMs,
      });
      const recordingId = recording.recordingId ?? recording.id;
      if (recordingId == null) throw new Error("녹음 ID가 응답에 없습니다.");
      await waitForRecordingQuality(activeSessionId, recordingId);
      await api.training.selectRecording(activeSessionId, recordingId);
      const requested = await api.training.analyze(activeSessionId);
      setPhase("analyzing");
      const completedAnalysisId = await waitForAnalysis(activeSessionId);
      await loadResult(
        activeSessionId,
        completedAnalysisId ?? requested.analysisId,
      );
    } catch (reason) {
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "음성 분석 요청에 실패했습니다.",
      );
      setPhase("review");
    }
  }

  async function retryFailedAnalysis() {
    if (!sessionId) return;
    setRequestError(null);
    setCanRetryAnalysis(false);
    setAnalysisProgress(0);
    setPhase("analyzing");
    try {
      const requested = await api.training.retryAnalysis(sessionId);
      const completedAnalysisId = await waitForAnalysis(sessionId);
      await loadResult(sessionId, completedAnalysisId ?? requested.analysisId);
    } catch (reason) {
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "음성 분석 재시도에 실패했습니다.",
      );
      setPhase("error");
    }
  }

  async function regenerateFeedback() {
    if (!analysis) return;
    setRegenerating(true);
    setRequestError(null);
    try {
      const feedback = await api.analyses.regenerateFeedback(
        analysis.id,
        "COACHING",
      );
      setAnalysis((current) =>
        current
          ? {
              ...current,
              strengths: feedback.strengths,
              weaknesses: feedback.weaknesses,
              summaryFeedback: feedback.summaryFeedback,
            }
          : current,
      );
    } catch (reason) {
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "AI 코칭을 다시 생성하지 못했습니다.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function goToNextContent() {
    setLoadingNext(true);
    setRequestError(null);
    try {
      const next = await api.content.getNext({
        type: content.contentType,
        category: content.category,
        difficulty: content.difficulty,
        excludeId: content.id,
      });
      const returnTo = searchParams.get("returnTo") ?? "/home";
      router.push(
        `/practice/${next.id}?returnTo=${encodeURIComponent(returnTo)}`,
      );
    } catch (reason) {
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "다음 콘텐츠를 불러오지 못했습니다.",
      );
      setLoadingNext(false);
    }
  }

  async function playReference() {
    try {
      const audios = await api.content.getReferenceAudios(content.id);
      const target = audios.find((audio) => audio.primary) ?? audios[0];
      if (!target) throw new Error("등록된 기준 음성이 없습니다.");
      const { playbackUrl } = await api.content.getReferenceAudioPlaybackUrl(
        target.id,
      );
      await new Audio(playbackUrl).play();
    } catch (reason) {
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "기준 음성을 재생하지 못했습니다.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-10">
      <section className="rounded-3xl bg-surface p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{content.title}</span>
          {content.referenceAudioAvailable && (
            <button
              onClick={() => void playReference()}
              className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 font-medium text-foreground"
            >
              <Volume2 className="size-3.5" />
              기준 음성 듣기
            </button>
          )}
        </div>
        <p className="mt-4 text-[22px] leading-[1.6] font-semibold tracking-tight">
          {content.scriptText}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {content.description}
        </p>
      </section>

      {phase !== "result" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          {(phase === "idle" || phase === "recording") && (
            <button
              onClick={() =>
                phase === "recording" ? recorder.stop() : void startRecording()
              }
              disabled={recorder.status === "requesting"}
              className={cn(
                "flex size-24 items-center justify-center rounded-full transition-all",
                phase === "idle" &&
                  "bg-foreground text-background hover:scale-105",
                phase === "recording" &&
                  "animate-pulse bg-destructive text-destructive-foreground",
              )}
              aria-label={phase === "recording" ? "녹음 종료" : "녹음 시작"}
            >
              {phase === "recording" ? (
                <Square className="size-8" />
              ) : (
                <Mic className="size-9" />
              )}
            </button>
          )}

          {phase === "review" && recorder.previewUrl && (
            <div className="w-full rounded-3xl border border-border p-5">
              <p className="mb-3 text-sm font-semibold">녹음 미리 듣기</p>
              <audio controls src={recorder.previewUrl} className="w-full" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    recorder.reset();
                    setRequestError(null);
                    setPhase("idle");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border py-3 text-xs font-semibold"
                >
                  <RotateCcw className="size-4" />
                  다시 녹음
                </button>
                <button
                  onClick={() => void analyze()}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground py-3 text-xs font-semibold text-background"
                >
                  <UploadCloud className="size-4" />
                  분석 요청
                </button>
              </div>
            </div>
          )}

          {(phase === "uploading" || phase === "analyzing") && (
            <div className="w-full rounded-3xl bg-surface p-5 text-center">
              <p className="text-sm font-semibold">
                {phase === "uploading" ? "음성 업로드 중…" : "음성 분석 중…"}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{
                    width: `${phase === "uploading" ? uploadProgress : analysisProgress}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {phase === "uploading" ? uploadProgress : analysisProgress}%
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="w-full rounded-3xl bg-destructive/10 p-5 text-center">
              <p className="text-sm font-semibold text-destructive">
                녹음을 시작할 수 없습니다
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {recorder.error ?? requestError}
              </p>
              <button
                onClick={() => {
                  recorder.reset();
                  setPhase("idle");
                }}
                className="mt-4 rounded-full border border-border px-5 py-2.5 text-xs font-semibold"
              >
                다시 시도
              </button>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {phase === "idle" && "문장을 읽고 녹음을 시작해 주세요"}
            {phase === "recording" &&
              `녹음 중 ${Math.floor(recorder.elapsedMs / 1000)}초 · 버튼을 눌러 종료`}
          </p>
          {requestError && (
            <div className="w-full text-center">
              <p
                role="alert"
                className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive"
              >
                {requestError}
              </p>
              {canRetryAnalysis && (
                <button
                  type="button"
                  onClick={() => void retryFailedAnalysis()}
                  className="mt-3 rounded-full bg-foreground px-5 py-2.5 text-xs font-semibold text-background"
                >
                  분석 다시 시도
                </button>
              )}
            </div>
          )}
        </div>
      ) : analysis ? (
        <>
          <section className="rounded-3xl border border-border p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">종합 점수</p>
                <p className="text-4xl font-bold">{Math.round(overall)}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>
                  발음 {Math.round(analysis.pronunciationScore)} · 억양{" "}
                  {Math.round(analysis.intonationScore)}
                </p>
                <p className="mt-1">
                  속도 {Math.round(analysis.speedWpm)} WPM ·{" "}
                  {analysis.speedStatus}
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-3xl bg-surface p-5">
            <h2 className="text-sm font-semibold">STT 결과</h2>
            <p className="mt-3 text-base leading-relaxed">
              {analysis.transcript}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              신뢰도 {Math.round(analysis.sttConfidence * 100)}%
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold">개선이 필요한 구간</h2>
            <div className="space-y-2">
              {selectedSegments.map((segment) => (
                <div
                  key={String(segment.id)}
                  className="rounded-2xl border border-border p-4"
                >
                  <div className="flex items-center justify-between">
                    <b>{segment.expectedText}</b>
                    <span className="text-xs text-destructive">
                      {Math.round(segment.pronunciationScore)}점
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    인식: {segment.recognizedText || "누락"} ·{" "}
                    {segment.errorType}
                  </p>
                  <p className="mt-2 text-xs">{segment.feedback}</p>
                </div>
              ))}
              {selectedSegments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  모든 구간을 안정적으로 발음했습니다.
                </p>
              )}
            </div>
          </section>
          <section className="grid gap-3">
            <div className="rounded-3xl bg-success/10 p-5">
              <h2 className="text-sm font-semibold">강점</h2>
              <ul className="mt-2 text-xs text-muted-foreground">
                {analysis.strengths.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-destructive/10 p-5">
              <h2 className="text-sm font-semibold">개선할 점</h2>
              <ul className="mt-2 text-xs text-muted-foreground">
                {analysis.weaknesses.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs">{analysis.summaryFeedback}</p>
              <button
                type="button"
                disabled={regenerating}
                onClick={() => void regenerateFeedback()}
                className="mt-4 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {regenerating ? "코칭 생성 중…" : "AI 코칭 다시 생성"}
              </button>
            </div>
          </section>
          {requestError && (
            <p
              role="alert"
              className="rounded-2xl bg-destructive/10 px-4 py-3 text-center text-xs text-destructive"
            >
              {requestError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                recorder.reset();
                setAnalysis(null);
                setSegments([]);
                setPhase("idle");
                setSessionId(null);
                sessionIdRef.current = null;
                completedRef.current = false;
              }}
              className="rounded-full border border-border py-4 text-sm font-semibold"
            >
              다시 연습
            </button>
            <button
              type="button"
              disabled={loadingNext}
              onClick={() => void goToNextContent()}
              className="rounded-full bg-foreground py-4 text-sm font-semibold text-background disabled:opacity-50"
            >
              {loadingNext ? "이동 중…" : "다음 콘텐츠"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
