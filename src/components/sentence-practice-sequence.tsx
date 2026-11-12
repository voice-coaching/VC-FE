"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RecordingPracticeSession,
  type PracticeSessionProps,
} from "./recording-practice-session";
import { AnalysisView } from "./analysis-view";
import { LoadingOverlay } from "./loading-overlay";
import { NewsRecordingControls, NewsRecordingReader } from "./news-recording";
import { PracticeAnalysisLoading } from "./practice-analysis-loading";
import { coachingLimitNotice } from "@/lib/coaching-usage";
import Link from "next/link";
import { MicrophonePermissionNotice } from "./microphone-permission-notice";
import { useAuthenticatedSentenceCapture } from "@/hooks/use-authenticated-sentence-capture";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { ReportSaveDialog } from "./report-save-dialog";
import { RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SentenceResultError,
  SentenceResultPending,
  SentenceResultTabs,
} from "./sentence-result-tabs";
import { NextPracticeContentButton } from "./next-practice-content-button";
import { api, type AnalysisResult } from "@/lib/api";
import { observeSentenceAnalysis } from "@/lib/sentence-analysis";
import {
  appendSentenceAdmission,
  releaseSentenceAdmission,
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
  const RecordingControls = NewsRecordingControls;
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
  const [activeResult, setActiveResult] = useState(0);
  // A single sentence being recorded again after results were shown.
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [retakeConfirm, setRetakeConfirm] = useState<number | null>(null);
  // Bumped per retake so the background submitter starts a fresh attempt
  // instead of restoring the previous one's recovery state.
  const [retakeRounds, setRetakeRounds] = useState<Record<number, number>>({});
  // Score of the take a retake replaced, so the new result can show the change.
  const [previousTakes, setPreviousTakes] = useState<Record<number, number>>(
    {},
  );
  // Sessions of replaced takes; with the live admissions they make up this run.
  const [retiredSessions, setRetiredSessions] = useState<string[]>([]);
  const [admissions, setAdmissions] = useState<
    (SentenceAnalysisAdmission | null)[]
  >([]);
  const admissionsRef = useRef<(SentenceAnalysisAdmission | null)[]>([]);
  const initializedScope = useRef<string | null>(null);
  const [results, setResults] = useState<Record<number, SentenceResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [nextHref, setNextHref] = useState<string | null>(null);
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
  const [submissionFailure, setSubmissionFailure] = useState<unknown>(null);
  const [submissionRetry, setSubmissionRetry] = useState(0);
  const capture = useAuthenticatedSentenceCapture(items, admissions, {
    userId,
    resource,
    resume: resumeRequested,
    ready,
  });
  const recording = capture.recorder.status === "recording";
  const waiting = capture.allCaptured && !recording;
  const allAdmitted = items.every((_, index) => Boolean(admissions[index]));
  const allResultsReady =
    allAdmitted && items.every((_, index) => results[index]?.result != null);
  const allCompleted =
    allResultsReady &&
    items.every(
      (_, index) => !results[index]?.reading && !results[index]?.error,
    );
  const canAdvance =
    allCompleted &&
    capture.allCaptured &&
    !recording &&
    !capture.saving &&
    !capture.hasFailedSave &&
    !capture.error;
  const shouldConfirmExit =
    !allCompleted &&
    (items.length > 1 ||
      capture.recorder.status === "requesting" ||
      recording ||
      capture.saving ||
      capture.recordedCount > 0 ||
      admissions.length > 0);
  const guard = useRecordingDiscardGuard(shouldConfirmExit, true);
  // When results arrive while the user watched the loading screen, hold its
  // finished state (check, "분석이 끝났어요") briefly, then reveal the report.
  // Restored sessions that open already finished skip the hold.
  const sawWaiting = useRef(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!allResultsReady) {
      if (waiting) sawWaiting.current = true;
      setRevealed(false);
      return;
    }
    if (!sawWaiting.current) {
      setRevealed(true);
      return;
    }
    const timer = window.setTimeout(() => {
      sawWaiting.current = false;
      setRevealed(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [allResultsReady, waiting]);
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
        admission,
        items[index],
        owner.signal,
        (result) => {
          if (owner.signal.aborted) return;
          setResults((current) => ({
            ...current,
            [index]: { result, reading: true },
          }));
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
      saved.forEach((admission, index) => {
        if (admission) observe(index, admission);
      });
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

  const retake = useCallback(
    (index: number) => {
      if (!mounted.current || authEpoch.current !== getAuthSessionVersion())
        return;
      owners.current.get(index)?.abort();
      owners.current.delete(index);
      const replaced = results[index]?.result?.overallScore;
      if (replaced != null)
        setPreviousTakes((current) => ({ ...current, [index]: replaced }));
      const replacedSession = admissionsRef.current[index]?.sessionId;
      if (replacedSession != null)
        setRetiredSessions((current) => [...current, String(replacedSession)]);
      const next = releaseSentenceAdmission(admissionsRef.current, index);
      admissionsRef.current = next;
      writeUserClientCache(userId, resource, next);
      setAdmissions(next);
      setResults((current) => {
        const rest = { ...current };
        delete rest[index];
        return rest;
      });
      setRetakeRounds((current) => ({
        ...current,
        [index]: (current[index] ?? 0) + 1,
      }));
      setSubmissionError(null);
      capture.retake(index);
      setActiveResult(index);
      setRetakeIndex(index);
    },
    [capture, resource, results, userId],
  );
  // The retake is over once that sentence has a fresh result.
  useEffect(() => {
    if (retakeIndex != null && results[retakeIndex]?.result)
      setRetakeIndex(null);
  }, [retakeIndex, results]);
  // Every session this run created; other sentences are never "earlier".
  const runSessions = useMemo(
    () => [
      ...retiredSessions,
      ...admissions.flatMap((admission) =>
        admission ? [String(admission.sessionId)] : [],
      ),
    ],
    [admissions, retiredSessions],
  );

  useEffect(() => {
    onTitleChange?.(waiting ? "문장별 분석 결과" : "연습하기");
  }, [waiting, onTitleChange]);

  if ((!ready || !capture.ready) && !recording && capture.recordedCount === 0)
    return <LoadingOverlay label="문장별 진행 상태를 확인하고 있어요" />;
  if (error || items.length === 0)
    return (
      <div className="space-y-4 px-5 py-10">
        {guard.dialog}
        <p role="alert">{error ?? "연습할 문장을 찾지 못했습니다."}</p>
        <button
          className="design-action"
          onClick={() => router.push("/mypage/history")}
        >
          학습 기록 확인
        </button>
      </div>
    );

  const workers = items.map((current, index) => {
    if (admissions[index] || !capture.files[index]) return null;
    const example =
      current.courseExampleIndex != null
        ? courseExamples?.items[current.courseExampleIndex]
        : null;
    return (
      <RecordingPracticeSession
        key={`${current.key}:${retakeRounds[index] ?? 0}`}
        {...props}
        content={{
          ...content,
          id: current.contentId,
          scriptText: current.text,
          learningFocus: example?.focus ?? content.learningFocus,
        }}
        courseExampleIndex={current.courseExampleIndex}
        sentenceIndex={current.sentenceIndex}
        capturedRecording={capture.files[index]}
        recoveryScope={
          capture.recoveryScope
            ? `${capture.recoveryScope}:${index}${retakeRounds[index] ? `:retake${retakeRounds[index]}` : ""}`
            : undefined
        }
        background
        autoSubmit
        onTitleChange={undefined}
        submissionRetry={submissionRetry}
        onSubmissionError={(message, reason) => {
          setSubmissionError(message);
          setSubmissionFailure(reason);
        }}
        onAnalysisAdmitted={(admission) => accept(index, admission)}
      />
    );
  });
  if (!allResultsReady || !revealed || recording) {
    const active = recording
      ? capture.recorder.index
      : Math.max(0, capture.nextIndex);
    const elapsed = Math.floor(capture.recorder.elapsedMs / 1000);
    return (
      <div className="flex min-h-full flex-col bg-[#f2f4f6]">
        {workers}
        {guard.dialog}
        {!waiting && (
          <NewsRecordingReader
            label={
              retakeIndex != null
                ? "다시 녹음"
                : content.contentType === "NEWS"
                  ? "뉴스 읽기"
                  : content.contentType === "ANNOUNCER"
                    ? "따라 읽기"
                    : content.origin === "USER_INPUT"
                      ? "내 문장 연습"
                      : "문장 연습"
            }
            sentences={
              retakeIndex != null
                ? [items[retakeIndex].text]
                : items.map((item) => item.text)
            }
            active={retakeIndex != null ? 0 : active}
            recording={recording}
          />
        )}
        {waiting && (
          <PracticeAnalysisLoading
            stepProgress={allResultsReady ? 100 : allAdmitted ? 66 : 0}
          />
        )}
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
          <RecordingControls
            paused={capture.recorder.paused}
            onTogglePause={capture.recorder.togglePause}
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
        {submissionError && (
          <div
            role="alert"
            className="mx-5 my-3 space-y-3 rounded-xl bg-white p-4 text-sm"
          >
            <p className="font-semibold text-destructive">
              {coachingLimitNotice(submissionFailure)?.title ?? submissionError}
            </p>
            <p>{coachingLimitNotice(submissionFailure)?.hint}</p>
            {coachingLimitNotice(submissionFailure) && (
              <Link
                className="inline-flex min-h-11 items-center font-semibold text-primary"
                href={
                  ["script", "audio"].includes(
                    coachingLimitNotice(submissionFailure)!.kind,
                  )
                    ? "/sentences"
                    : "/mypage/payments?view=manage"
                }
              >
                {["script", "audio"].includes(
                  coachingLimitNotice(submissionFailure)!.kind,
                )
                  ? "다른 문장 선택"
                  : "코칭 사용량·이용권 확인"}
              </Link>
            )}
            <button
              type="button"
              className="design-action"
              onClick={() => {
                setSubmissionError(null);
                setSubmissionFailure(null);
                setSubmissionRetry((value) => value + 1);
              }}
            >
              같은 녹음으로 접수 다시 시도
            </button>
          </div>
        )}
        {waiting && (
          <div className="mt-auto space-y-3 px-5 py-5">
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
                    onClick={() => observe(index, admissions[index]!)}
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

  const activeIndex = Math.min(activeResult, items.length - 1);
  return (
    <div className="report-reveal pb-5">
      {guard.dialog}
      <SentenceResultTabs
        active={activeIndex}
        onSelect={setActiveResult}
        tabs={items.map((item, index) => ({
          key: item.key,
          text: item.text,
          state: results[index]?.result
            ? "ready"
            : results[index]?.error
              ? "error"
              : "pending",
          score: results[index]?.result?.overallScore,
          details: results[index]?.result?.scoreDetails,
        }))}
        renderPanel={(shown) => {
          const shownState = results[shown];
          const shownAdmission = admissions[shown];
          const shownItem = items[shown];
          return (
            <>
              {shownState?.result ? (
                <>
                  <AnalysisView
                    key={shownItem.key}
                    analysis={shownState.result}
                    segments={[]}
                    content={{
                      ...content,
                      id: shownItem.contentId,
                      scriptText: shownItem.text,
                    }}
                    recordingId={shownAdmission!.recordingId}
                    sessionId={shownAdmission!.sessionId}
                    reportParameter={`sentenceReport${shown}`}
                    courseMode={Boolean(courseId)}
                    previousScore={
                      previousTakes[shown] != null
                        ? { score: previousTakes[shown], scope: "retake" }
                        : undefined
                    }
                    comparisonExclude={runSessions}
                  />
                  {/* Server says whether another take is allowed; default to yes. */}
                  {shownState.result.canonical?.actions.canRerecord !== false &&
                    !shownState.reading && (
                      <div className="px-5 pt-1 pb-2">
                        <button
                          type="button"
                          onClick={() => setRetakeConfirm(shown)}
                          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-white text-[15px] font-bold text-[#4e5968] shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
                        >
                          <RotateCcw
                            size={17}
                            strokeWidth={2.25}
                            aria-hidden="true"
                          />
                          이 문장 다시 녹음
                        </button>
                      </div>
                    )}
                </>
              ) : shownState?.error ? (
                <SentenceResultError
                  message={shownState.error}
                  busy={shownState.reading}
                  onRetry={() => observe(shown, shownAdmission!)}
                />
              ) : (
                <SentenceResultPending />
              )}
              {shownState?.result &&
                (shownState.reading || shownState.error) && (
                  <div className="px-5 pt-1 text-sm text-muted-foreground">
                    <p role="status">
                      {shownState.error ??
                        "피드백이 준비됐어요. 학습 이력 저장을 확인하고 있어요."}
                    </p>
                    {shownState.error && (
                      <button
                        type="button"
                        className="min-h-11 rounded-xl border px-4"
                        onClick={() => observe(shown, shownAdmission!)}
                      >
                        기존 결과 저장 상태 다시 확인
                      </button>
                    )}
                  </div>
                )}
            </>
          );
        }}
      />
      <div className="space-y-4 px-5 pt-2">
        <button
          className="design-action"
          disabled={!canAdvance}
          onClick={() => {
            setNextHref(null);
            setSaveOpen(true);
          }}
        >
          {allCompleted ? "완료하기" : "학습 이력 저장 확인 중…"}
        </button>
        {!courseId &&
          ["NEWS", "SENTENCE", "ANNOUNCER"].includes(content.contentType) && (
            <NextPracticeContentButton
              content={content}
              recordingComplete={canAdvance}
              onNext={(href) => {
                if (!canAdvance) return;
                setNextHref(href);
                setSaveOpen(true);
              }}
            />
          )}
        <button
          className="min-h-11 w-full text-sm text-muted-foreground"
          onClick={() => router.push("/mypage/history")}
        >
          학습 기록에서 확인
        </button>
      </div>
      <AlertDialog
        open={retakeConfirm != null}
        onOpenChange={(open) => {
          if (!open) setRetakeConfirm(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-40px)] max-w-[342px] rounded-[24px] border-0">
          <AlertDialogHeader>
            <AlertDialogTitle>이 문장을 다시 녹음할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              새로 녹음한 결과로 바뀌어요. 지금 결과는 학습 기록에 남아요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 grid grid-cols-2 gap-2 space-x-0">
            <AlertDialogCancel className="mt-0 min-h-12 rounded-full">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12 rounded-full bg-primary text-white"
              onClick={() => {
                if (retakeConfirm != null) retake(retakeConfirm);
                setRetakeConfirm(null);
              }}
            >
              다시 녹음
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReportSaveDialog
        open={saveOpen}
        onOpenChange={(open) => {
          setSaveOpen(open);
          if (!open) setNextHref(null);
        }}
        onConfirm={async (saved) => {
          if (!canAdvance)
            throw new Error("모든 문장의 녹음을 완료한 뒤 이동해 주세요.");
          await Promise.all(
            admissions.map((admission) =>
              reportSaves.set("SESSION", admission!.sessionId, saved),
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
          if (!mounted.current || authEpoch.current !== getAuthSessionVersion())
            throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
          await capture.cleanup();
          if (!mounted.current || authEpoch.current !== getAuthSessionVersion())
            throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
          removeUserClientCache(userId, resource);
          router.push(
            nextHref ??
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
