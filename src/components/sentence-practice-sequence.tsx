"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RecordingPracticeSession,
  type PracticeSessionProps,
} from "./recording-practice-session";
import { AnalysisView } from "./analysis-view";
import { LoadingOverlay } from "./loading-overlay";
import { SentenceReader } from "./sentence-reader";
import { SentenceRecordingControls } from "./sentence-recording-controls";
import { MicrophonePermissionNotice } from "./microphone-permission-notice";
import { useAuthenticatedSentenceCapture } from "@/hooks/use-authenticated-sentence-capture";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { ReportSaveDialog } from "./report-save-dialog";
import { api, type AnalysisResult } from "@/lib/api";
import { observeSentenceAnalysis } from "@/lib/sentence-analysis";
import {
  appendSentenceAdmission,
  sentencePracticeItems,
  type SentenceAnalysisAdmission,
} from "@/lib/sentence-sequence";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import {
  readUserClientCache,
  removeUserClientCache,
  writeUserClientCache,
} from "@/lib/client-cache";
import { invalidateLearningCaches } from "@/lib/learning-cache";
import { reportSaves } from "@/lib/report-saves";
import { courseResultProgress } from "@/lib/course-result-progress";
import { safeInternalPath } from "@/lib/navigation";
import { ApiError, getAuthSessionVersion } from "@/lib/api/client";
import {
  admittedSequenceHref,
  initialSentenceAdmissions,
  sentenceResumeRequested,
} from "@/lib/practice-entry";

type SentenceResult = {
  result?: AnalysisResult;
  error?: string;
  reading?: boolean;
};

export function SentencePracticeSequence(props: PracticeSessionProps) {
  const { content, courseExamples, courseExampleIndex, onTitleChange } = props;
  const router = useRouter();
  const params = useSearchParams();
  const [resumeRequested] = useState(() => sentenceResumeRequested(params));
  const courseId = params.get("courseId");
  const courseStepId = params.get("courseStepId");
  const userId = getAuthenticatedUserId();
  // Parent title/catalog refreshes can replace props with equivalent objects.
  // Keep observer/capture lifetimes tied to actual sentence identities.
  const itemIdentity = JSON.stringify(
    sentencePracticeItems(content, courseExamples, courseExampleIndex ?? 0),
  );
  const items = useMemo(
    () =>
      sentencePracticeItems(content, courseExamples, courseExampleIndex ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemIdentity],
  );
  const resource = `sentence-sequence-v1:${courseId ?? content.id}:${courseExamples?.revision ?? "content"}:${courseExampleIndex ?? 0}`;
  const [ready, setReady] = useState(!resumeRequested);
  const [admissions, setAdmissions] = useState<SentenceAnalysisAdmission[]>([]);
  const admissionsRef = useRef<SentenceAnalysisAdmission[]>([]);
  const initializedScope = useRef<string | null>(null);
  const [results, setResults] = useState<Record<number, SentenceResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const owners = useRef(new Map<number, AbortController>());
  const mounted = useRef(false),
    authEpoch = useRef(getAuthSessionVersion());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionRetry, setSubmissionRetry] = useState(0);
  const capture = useAuthenticatedSentenceCapture(items, admissions, {
    userId,
    resource,
    resume: resumeRequested,
    ready,
  });
  const recording = capture.recorder.status === "recording";
  const waiting = capture.allCaptured && !recording;
  const guard = useRecordingDiscardGuard(
    recording ||
      capture.saving ||
      (!capture.allCaptured && capture.recordedCount > 0),
    true,
  );
  useEffect(() => {
    if (error) capture.recorder.reset();
  }, [error, capture.recorder.reset]);

  const observe = useCallback(
    (index: number, admission: SentenceAnalysisAdmission) => {
      if (!mounted.current || authEpoch.current !== getAuthSessionVersion())
        return;
      if (owners.current.has(index)) return;
      const owner = new AbortController();
      owners.current.set(index, owner);
      setResults((current) => ({
        ...current,
        [index]: { ...current[index], reading: true, error: undefined },
      }));
      void observeSentenceAnalysis(
        admission, items[index], owner.signal, (result) => {
          if (owner.signal.aborted) return;
          setResults((current) => ({ ...current, [index]: { result, reading: true } }));
        },
      )
        .then((result) => {
          if (owner.signal.aborted) return;
          invalidateLearningCaches();
          setResults((current) => ({
            ...current,
            [index]: { result, reading: false },
          }));
        })
        .catch((reason: unknown) => {
          if (owner.signal.aborted) return;
          if (
            reason instanceof ApiError &&
            reason.code === "SENTENCE_SEQUENCE_CHANGED"
          )
            setError(reason.message);
          setResults((current) => ({
            ...current,
            [index]: {
              ...current[index],
              reading: false,
              error:
                reason instanceof Error
                  ? reason.message
                  : "문장 분석 결과를 확인하지 못했습니다.",
            },
          }));
        })
        .finally(() => {
          if (owners.current.get(index) === owner) owners.current.delete(index);
        });
    },
    [items],
  );

  useEffect(() => {
    if (resumeRequested) setReady(false);
    try {
      const saved = initialSentenceAdmissions(
        resumeRequested,
        resumeRequested ? readUserClientCache(userId, resource) : null,
        items.length,
        initializedScope.current === `${userId}:${resource}`
          ? admissionsRef.current
          : undefined,
      );
      initializedScope.current = `${userId}:${resource}`;
      admissionsRef.current = saved;
      setAdmissions(saved);
      setResults({});
      setError(null);
      saved.forEach((admission, index) => observe(index, admission));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "진행 상태를 확인하지 못했습니다.",
      );
    }
    setReady(true);
    const activeOwners = owners.current;
    return () => {
      // Stop local reads only; accepted server jobs must continue.
      activeOwners.forEach((owner) => owner.abort());
      activeOwners.clear();
    };
  }, [items.length, observe, resource, userId, resumeRequested]);

  const accept = useCallback(
    (index: number, admission: SentenceAnalysisAdmission) => {
      if (!mounted.current || authEpoch.current !== getAuthSessionVersion())
        return;
      const next = appendSentenceAdmission(
        admissionsRef.current,
        index,
        admission,
      );
      if (next === admissionsRef.current) return;
      setSubmissionError(null);
      admissionsRef.current = next;
      // Persist just server identifiers. Audio and transcripts are not stored here.
      writeUserClientCache(userId, resource, next);
      if (
        next.length === 1 &&
        !sentenceResumeRequested(new URLSearchParams(window.location.search))
      )
        window.history.replaceState(
          null,
          "",
          admittedSequenceHref(window.location.href),
        );
      setAdmissions(next);
      observe(index, admission);
    },
    [observe, resource, userId],
  );

  const currentIndex = admissions.length;
  const current = items[currentIndex];
  const allAdmitted = currentIndex === items.length;
  const allResultsReady =
    allAdmitted && items.every((_, index) => results[index]?.result != null);
  const allCompleted = allResultsReady && items.every(
    (_, index) => !results[index]?.reading && !results[index]?.error,
  );
  useEffect(() => {
    onTitleChange?.(waiting ? "문장별 분석 결과" : "문장 연습");
  }, [waiting, onTitleChange]);

  if ((!ready || !capture.ready) && !recording && capture.recordedCount === 0)
    return <LoadingOverlay label="문장별 진행 상태를 확인하고 있어요" />;
  if (error || items.length === 0)
    return (
      <div className="space-y-4 px-5 py-10">
        <p role="alert">{error ?? "연습할 문장을 찾지 못했습니다."}</p>
        <button
          className="design-action"
          onClick={() => router.push("/mypage/history")}
        >
          학습 기록 확인
        </button>
      </div>
    );

  const example =
    current?.courseExampleIndex != null
      ? courseExamples?.items[current.courseExampleIndex]
      : null;
  const worker =
    current && capture.files[currentIndex] ? (
      <RecordingPracticeSession
        key={current.key}
        {...props}
        content={{
          ...content,
          id: current.contentId,
          scriptText: current.text,
          learningFocus: example?.focus ?? content.learningFocus,
        }}
        courseExampleIndex={current.courseExampleIndex}
        sentenceIndex={current.sentenceIndex}
        capturedRecording={capture.files[currentIndex]}
        background
        autoSubmit
        onTitleChange={undefined}
        submissionRetry={submissionRetry}
        onSubmissionError={setSubmissionError}
        onAnalysisAdmitted={(admission) => accept(currentIndex, admission)}
      />
    ) : null;
  if (!allResultsReady || recording) {
    const active = recording
      ? capture.recorder.index
      : Math.max(0, capture.nextIndex);
    const elapsed = Math.floor(capture.recorder.elapsedMs / 1000);
    return (
      <div className="flex min-h-full flex-col bg-[#f2f4f6]">
        {worker}
        {guard.dialog}
        <header className="px-5 py-5">
          <h2 className="text-lg font-bold">
            {waiting
              ? "문장별 피드백을 모으고 있어요"
              : `${active + 1} / ${items.length} 문장`}
          </h2>
          <p className="mt-2 text-sm text-[#6b7684]">
            {waiting
              ? "녹음을 모두 마쳤어요. 모든 문장의 분석이 끝나면 결과를 한 번에 보여 드려요."
              : "다 읽으면 다음 문장을 눌러 이어서 녹음해 주세요."}
          </p>
        </header>
        <SentenceReader
          sentences={items.map((item) => item.text)}
          activeIndex={recording ? active : undefined}
          variant={recording ? "recording" : "reader"}
          className="mx-5 max-h-[45dvh]"
        />
        <p role="status" className="px-5 py-4 text-sm text-[#6b7684]">
          {waiting
            ? `${Object.values(results).filter((value) => value.result).length}/${items.length} 문장 분석 완료`
            : `녹음 완료 ${capture.recordedCount}/${items.length} 문장`}
        </p>
        {(capture.recorder.error || (!recording && capture.error)) && (
          <p
            role="alert"
            className="mx-5 rounded-2xl bg-red-50 p-4 text-sm text-red-600"
          >
            {capture.recorder.error ?? capture.error}
          </p>
        )}
        {capture.recorder.status === "denied" && <MicrophonePermissionNotice />}
        {!waiting && (
          <SentenceRecordingControls
            contentId={items[active]?.contentId ?? content.id}
            stream={capture.recorder.getStream()}
            referenceAvailable={
              content.referenceAudioAvailable && items.length === 1
            }
            scriptText={items[active]?.text ?? content.scriptText}
            elapsed={`${Math.floor(elapsed / 60)
              .toString()
              .padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`}
            busy={!recording || capture.recorder.splitting}
            last={active === items.length - 1}
            recording={recording}
            requesting={
              !capture.ready || capture.recorder.status === "requesting"
            }
            onStart={capture.start}
            onComplete={() => void capture.recorder.advance()}
          />
        )}
        {!recording && capture.hasFailedSave && (
          <button
            type="button"
            className="design-action"
            onClick={capture.retrySave}
          >
            녹음 보관 다시 시도
          </button>
        )}
        {waiting && (
          <div className="mt-auto space-y-3 px-5 py-5">
            {submissionError && (
              <>
                <p role="alert" className="text-sm text-destructive">
                  {submissionError}
                </p>
                <button
                  type="button"
                  className="design-action"
                  onClick={() => {
                    setSubmissionError(null);
                    setSubmissionRetry((value) => value + 1);
                  }}
                >
                  같은 문장 접수 상태 다시 확인
                </button>
              </>
            )}
            {items.map((item, index) =>
              results[index]?.error && admissions[index] ? (
                <div key={item.key} className="space-y-2">
                  <p role="alert" className="text-sm text-destructive">
                    {index + 1}번째 문장: {results[index].error}
                  </p>
                  <button
                    type="button"
                    className="design-action"
                    disabled={results[index].reading}
                    onClick={() => observe(index, admissions[index])}
                  >
                    기존 분석 상태 다시 확인
                  </button>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 py-5">
      <h2 className="text-xl font-bold">문장별 분석 결과</h2>
      <p role="status" className="text-sm text-muted-foreground">
        {Object.values(results).filter((item) => item.result).length}/
        {items.length} 문장 분석 완료
      </p>
      {items.map((item, index) => {
        const state = results[index];
        const admission = admissions[index];
        return (
          <section
            key={item.key}
            aria-label={`${index + 1}번 문장 분석`}
            className="rounded-2xl bg-white py-4"
          >
            <h3 className="px-4 font-semibold">{index + 1}번 문장</h3>
            <p className="px-4 pt-2 text-sm leading-6">{item.text}</p>
            {state?.result ? (
              <AnalysisView
                analysis={state.result}
                segments={[]}
                content={{
                  ...content,
                  id: item.contentId,
                  scriptText: item.text,
                }}
                recordingId={admission.recordingId}
                reportParameter={`sentenceReport${index}`}
                courseMode={Boolean(courseId)}
              />
            ) : state?.error ? (
              <div className="space-y-3 px-4 pt-4">
                <p role="alert" className="text-sm text-destructive">
                  {state.error}
                </p>
                <button
                  className="min-h-11 rounded-xl border px-4 text-sm"
                  disabled={state.reading}
                  onClick={() => observe(index, admission)}
                >
                  기존 분석 상태 다시 확인
                </button>
              </div>
            ) : (
              <p className="px-4 pt-4 text-sm text-muted-foreground">
                분석 결과를 기다리고 있어요.
              </p>
            )}
            {state?.result && (state.reading || state.error) && (
              <div className="px-4 pt-3 text-sm text-muted-foreground">
                <p role="status">{state.error ?? "피드백이 준비됐어요. 학습 이력 저장을 확인하고 있어요."}</p>
                {state.error && (
                  <button type="button" className="min-h-11 rounded-xl border px-4" onClick={() => observe(index, admission)}>
                    기존 결과 저장 상태 다시 확인
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
      <button
        className="design-action"
        disabled={!allCompleted}
        onClick={() => setSaveOpen(true)}
      >
        {allCompleted ? "완료하기" : "학습 이력 저장 확인 중…"}
      </button>
      <button
        className="min-h-11 w-full text-sm text-muted-foreground"
        onClick={() => router.push("/mypage/history")}
      >
        학습 기록에서 확인
      </button>
      <ReportSaveDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        onConfirm={async (saved) => {
          await Promise.all(
            admissions.map((admission) =>
              reportSaves.set("SESSION", admission.sessionId, saved),
            ),
          );
          if (courseId && courseExamples) {
            await api.courses.updateProgress(courseId, {
              lastStepId: courseExamples.stepId,
              progressPercent: 100,
            });
            await api.courses.complete(courseId);
          } else if (courseId && courseStepId) {
            const [steps, progress] = await Promise.all([
              api.courses.getSteps(courseId),
              api.courses.getProgress(courseId),
            ]);
            const update = courseResultProgress(steps, progress, courseStepId);
            await api.courses.updateProgress(courseId, update);
            if (update.progressPercent >= 100)
              await api.courses.complete(courseId);
          }
          invalidateLearningCaches();
          await capture.cleanup();
          removeUserClientCache(userId, resource);
          router.push(
            safeInternalPath(
              params.get("returnTo"),
              courseId ? "/class" : "/home",
            ),
          );
        }}
      />
    </div>
  );
}
