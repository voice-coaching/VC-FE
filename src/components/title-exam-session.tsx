"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecordingPracticeSession,
  type PracticeSessionProps,
} from "./recording-practice-session";
import { api, type Id, type UserTitleExamResult } from "@/lib/api";
import { ApiError, getAuthSessionVersion } from "@/lib/api/client";
import {
  createTitleExamSession,
  titleExamErrorMessage,
} from "@/lib/title-exam";
import { loadTitleExamResume } from "@/lib/title-exam-resume";
import { invalidateLearningCaches } from "@/lib/learning-cache";

/** Owns the exam lifecycle and grading; recording and analysis stay shared. */
export function TitleExamSession({
  examId,
  content,
  ...props
}: PracticeSessionProps & { examId: Id }) {
  const router = useRouter();
  const [result, setResult] = useState<UserTitleExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const analysisIdRef = useRef<Id | null>(null);
  const submitBusyRef = useRef(false);
  const authEpochRef = useRef(getAuthSessionVersion());
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const createSession = useCallback(
    () => createTitleExamSession(api, examId, content.id),
    [examId, content.id],
  );
  const restoreSession = useCallback(
    (isCurrent: () => boolean) =>
      loadTitleExamResume(api, examId, content.id, isCurrent),
    [examId, content.id],
  );
  const submitResult = useCallback(
    async (analysisId: Id) => {
      if (submitBusyRef.current) return;
      analysisIdRef.current = analysisId;
      submitBusyRef.current = true;
      setSubmitting(true);
      setError(null);
      const isCurrent = () =>
        mountedRef.current && authEpochRef.current === getAuthSessionVersion();
      try {
        const graded = await api.users.submitTitleExam(examId, analysisId);
        if (!isCurrent()) return;
        setResult(graded);
        // Completion is cached before grading; promotion must invalidate it again.
        invalidateLearningCaches();
      } catch (reason) {
        if (isCurrent()) setError(titleExamErrorMessage(reason));
      } finally {
        submitBusyRef.current = false;
        if (isCurrent()) setSubmitting(false);
      }
    },
    [examId],
  );

  return (
    <RecordingPracticeSession
      {...props}
      content={content}
      workflow={{
        createSession,
        restoreSession,
        onComplete: submitResult,
        learningFocus: "PRONUNCIATION",
        analysisScope: "TITLE_EXAM",
        title: "승급 시험",
        resultTitle: "승급 시험 결과",
        restoringLabel: "승급 시험을 준비하고 있어요",
        completionHref: "/mypage",
        renderErrorDetails: renderTitleExamErrorDetails,
        resultSummary: (
          <>
            {result && (
              <section
                className={`design-card border ${result.passed ? "border-[#84dfb7] bg-[#effcf6]" : "border-[#ffc4b8] bg-[#fff5f2]"}`}
                aria-label="승급 시험 결과"
              >
                <p className="text-xs font-semibold text-[#6b7684]">
                  승급 시험 {result.score}점 · 합격 기준 {result.passingScore}점
                </p>
                <h2 className="mt-2 text-xl font-bold">
                  {result.passed
                    ? `${result.currentTitle} 칭호로 승급했어요!`
                    : "아쉽게도 이번에는 불합격이에요"}
                </h2>
                <p className="mt-2 text-sm text-[#6b7684]">
                  {result.passed
                    ? "새 칭호는 마이페이지에 바로 반영됩니다."
                    : "마이페이지에서 다음 응시 가능 여부를 확인해 주세요."}
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/mypage")}
                  className="mt-4 min-h-11 w-full rounded-full bg-primary text-sm font-semibold text-white"
                >
                  마이페이지에서 칭호 확인
                </button>
              </section>
            )}
            {error && (
              <div
                role="alert"
                className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive"
              >
                {error}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    if (analysisIdRef.current != null)
                      void submitResult(analysisIdRef.current);
                  }}
                  className="mt-3 block min-h-11 w-full rounded-xl border border-current font-semibold disabled:opacity-50"
                >
                  {submitting ? "채점 확인 중…" : "채점 다시 확인"}
                </button>
              </div>
            )}
          </>
        ),
      }}
    />
  );
}

function renderTitleExamErrorDetails(reason: unknown) {
  if (!(reason instanceof ApiError)) return null;
  return (
    <section
      aria-label="승급 시험 오류 진단"
      className="mt-6 rounded-xl border border-border bg-white p-4 text-left"
    >
      <h3 className="text-sm font-semibold">임시 오류 진단</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        아래 내용을 캡처해 주세요. 인증 정보는 제외됩니다.
      </p>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 select-text">
        {JSON.stringify(
          {
            request: reason.diagnostics?.request ?? null,
            status: reason.status,
            code: reason.code,
            message: reason.message,
            response: reason.diagnostics?.response ?? null,
          },
          null,
          2,
        )}
      </pre>
    </section>
  );
}
