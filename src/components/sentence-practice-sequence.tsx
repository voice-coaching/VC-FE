"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RecordingPracticeSession,
  type PracticeSessionProps,
} from "./recording-practice-session";
import { AnalysisView } from "./analysis-view";
import { LoadingOverlay } from "./loading-overlay";
import { ReportSaveDialog } from "./report-save-dialog";
import { api, type AnalysisResult } from "@/lib/api";
import { observeSentenceAnalysis } from "@/lib/sentence-analysis";
import {
  appendSentenceAdmission,
  readSentenceAdmissions,
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
import { ApiError } from "@/lib/api/client";

type SentenceResult = {
  result?: AnalysisResult;
  error?: string;
  reading?: boolean;
};

export function SentencePracticeSequence(props: PracticeSessionProps) {
  const { content, courseExamples, courseExampleIndex, onTitleChange } = props;
  const router = useRouter();
  const params = useSearchParams();
  const courseId = params.get("courseId");
  const courseStepId = params.get("courseStepId");
  const userId = getAuthenticatedUserId();
  const items = useMemo(
    () =>
      sentencePracticeItems(content, courseExamples, courseExampleIndex ?? 0),
    [content, courseExamples, courseExampleIndex],
  );
  const resource = `sentence-sequence-v1:${courseId ?? content.id}:${courseExamples?.revision ?? "content"}:${courseExampleIndex ?? 0}`;
  const [ready, setReady] = useState(false);
  const [admissions, setAdmissions] = useState<SentenceAnalysisAdmission[]>([]);
  const admissionsRef = useRef<SentenceAnalysisAdmission[]>([]);
  const [results, setResults] = useState<Record<number, SentenceResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const owners = useRef(new Map<number, AbortController>());

  const observe = useCallback(
    (index: number, admission: SentenceAnalysisAdmission) => {
      if (owners.current.has(index)) return;
      const owner = new AbortController();
      owners.current.set(index, owner);
      setResults((current) => ({
        ...current,
        [index]: { ...current[index], reading: true, error: undefined },
      }));
      void observeSentenceAnalysis(admission, items[index], owner.signal)
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
    setReady(false);
    try {
      const saved = readSentenceAdmissions(
        readUserClientCache(userId, resource),
        items.length,
      );
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
  }, [items.length, observe, resource, userId]);

  const accept = useCallback(
    (index: number, admission: SentenceAnalysisAdmission) => {
      const next = appendSentenceAdmission(
        admissionsRef.current,
        index,
        admission,
      );
      if (next === admissionsRef.current) return;
      admissionsRef.current = next;
      // Persist just server identifiers. Audio and transcripts are not stored here.
      writeUserClientCache(userId, resource, next);
      setAdmissions(next);
      observe(index, admission);
    },
    [observe, resource, userId],
  );

  const currentIndex = admissions.length;
  const current = items[currentIndex];
  const allAdmitted = currentIndex === items.length;
  const allCompleted =
    allAdmitted && items.every((_, index) => results[index]?.result != null);
  useEffect(() => {
    if (allAdmitted) onTitleChange?.("문장별 분석 결과");
  }, [allAdmitted, onTitleChange]);

  if (!ready)
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

  if (current) {
    const example =
      current.courseExampleIndex != null
        ? courseExamples?.items[current.courseExampleIndex]
        : null;
    return (
      <div className="flex min-h-full flex-col">
        <p role="status" className="px-5 py-2 text-xs text-muted-foreground">
          {currentIndex + 1}/{items.length} 문장 · {admissions.length}개 분석
          접수
        </p>
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
          autoSubmit
          onAnalysisAdmitted={(admission) => accept(currentIndex, admission)}
        />
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
          </section>
        );
      })}
      <button
        className="design-action"
        disabled={!allCompleted}
        onClick={() => setSaveOpen(true)}
      >
        {allCompleted ? "완료하기" : "문장별 분석 확인 중…"}
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
