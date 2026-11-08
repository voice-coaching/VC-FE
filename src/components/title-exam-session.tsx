"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecordingPracticeSession,
  type PracticeSessionProps,
} from "./recording-practice-session";
import {
  api,
  type Id,
  type UserTitleExam,
  type UserTitleExamResult,
} from "@/lib/api";
import { ApiError, getAuthSessionVersion } from "@/lib/api/client";
import {
  createTitleExamSession,
  prepareTitleExam,
  titleExamErrorMessage,
  validateTitleExamResult,
} from "@/lib/title-exam";
import { loadTitleExamResume } from "@/lib/title-exam-resume";
import { invalidateLearningCaches } from "@/lib/learning-cache";
import { LoadingOverlay } from "./loading-overlay";

/** Owns the exam lifecycle and grading; recording and analysis stay shared. */
export function TitleExamSession({
  examId,
  content,
  ...props
}: PracticeSessionProps & { examId: Id }) {
  const router = useRouter();
  const [entry, setEntry] = useState<{
    exam: UserTitleExam;
    needsChoice: boolean;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const epoch = useRef(getAuthSessionVersion());
  const newExamKey = useRef<string | null>(null);
  const [resumeApproved, setResumeApproved] = useState(false);
  const requireChoice = useCallback(() => {
    setReady(false);
    setChecking((value) => value + 1);
  }, []);
  const isCurrent = () =>
    mounted.current && epoch.current === getAuthSessionVersion();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setEntry(null);
    setReady(false);
    setResumeApproved(false);
    setError(null);
    props.onTitleChange?.("승급 시험");
    void (async () => {
      try {
        // Read only. Do not mount the recorder, restore analyses, grade, or
        // create/cancel sessions until an existing attempt has been chosen.
        const exam = await api.users.getTitleExam(examId);
        if (!active || !isCurrent()) return;
        if (
          String(exam.id) !== String(examId) ||
          String(exam.practiceContentId) !== String(content.id)
        )
          throw new Error("시험과 연습 콘텐츠가 일치하지 않습니다.");
        let needsChoice = ["PASSED", "FAILED"].includes(exam.status);
        if (exam.trainingSessionId != null) {
          const [session, recordings] = await Promise.all([
            api.training.get(exam.trainingSessionId),
            api.training.listRecordings(exam.trainingSessionId),
          ]);
          if (!active || !isCurrent()) return;
          needsChoice ||=
            recordings.length > 0 ||
            (session.recordingCount ?? 0) > 0 ||
            session.analysisAvailable === true ||
            ["ANALYZING", "COMPLETED"].includes(session.status);
        }
        setEntry({ exam, needsChoice });
        setReady(!needsChoice);
      } catch (reason) {
        if (active && isCurrent()) setError(titleExamErrorMessage(reason));
      }
    })();
    return () => {
      active = false;
    };
    // Entry is checked once per exam; a choice is never persisted across visits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, content.id, checking]);

  async function restart() {
    if (!entry || busy.current) return;
    busy.current = true;
    setRestarting(true);
    setError(null);
    try {
      if (["PASSED", "FAILED"].includes(entry.exam.status)) {
        newExamKey.current ??= crypto.randomUUID();
        const href = await prepareTitleExam(api, "/mypage", newExamKey.current);
        if (isCurrent()) router.replace(href);
        return;
      }
      if (entry.exam.trainingSessionId == null)
        throw new Error("시험 세션을 확인하지 못했습니다.");
      const exam = await api.users.restartTitleExam(
        examId,
        entry.exam.trainingSessionId,
      );
      if (!isCurrent()) return;
      if (
        String(exam.id) !== String(examId) ||
        String(exam.practiceContentId) !== String(content.id) ||
        exam.trainingSessionId == null ||
        ["PASSED", "FAILED"].includes(exam.status)
      )
        throw new Error(
          "새 시험 세션을 확인하지 못했습니다. 다시 확인해 주세요.",
        );
      // Re-read before entering: another tab may have already used a replayed
      // replacement. An existing recording still needs an explicit choice.
      setEntry(null);
      setChecking((value) => value + 1);
    } catch (reason) {
      if (isCurrent()) setError(titleExamErrorMessage(reason));
    } finally {
      busy.current = false;
      if (isCurrent()) setRestarting(false);
    }
  }

  if (ready && entry)
    return (
      <ActiveTitleExamSession
        key={String(entry.exam.trainingSessionId ?? "new")}
        {...props}
        content={content}
        examId={examId}
        resumeApproved={resumeApproved}
        onResumeRequired={requireChoice}
      />
    );
  if (!entry && !error)
    return <LoadingOverlay label="이전 시험 기록을 확인하고 있어요" />;
  return (
    <section
      className="space-y-5 px-5 py-10"
      aria-labelledby="title-exam-entry-title"
    >
      <h1 id="title-exam-entry-title" className="text-xl font-bold">
        {entry ? "이전 시험 기록이 있어요" : "시험 기록을 확인하지 못했어요"}
      </h1>
      {entry && (
        <p className="text-sm leading-6 text-muted-foreground">
          이어서 진행하면 이전 녹음과 분석 상태를 확인해요. 새로 시작하면 새
          녹음으로 응시하며, 진행 중인 이전 분석은 취소됩니다.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {entry ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={restarting}
            onClick={() => {
              setResumeApproved(true);
              setReady(true);
            }}
            className="min-h-12 w-full rounded-full bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            이어서 진행
          </button>
          <button
            type="button"
            disabled={restarting}
            onClick={() => void restart()}
            className="min-h-12 w-full rounded-full border border-primary px-5 text-sm font-semibold text-primary disabled:opacity-50"
          >
            {restarting ? "새 시험 준비 중…" : "새로 시작"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setChecking((value) => value + 1)}
          className="min-h-12 w-full rounded-full bg-primary text-sm font-semibold text-white"
        >
          다시 확인
        </button>
      )}
      <button
        type="button"
        disabled={restarting}
        onClick={() => router.push("/mypage")}
        className="min-h-11 w-full text-sm text-muted-foreground"
      >
        마이페이지로 돌아가기
      </button>
    </section>
  );
}

function ActiveTitleExamSession({
  examId,
  content,
  resumeApproved,
  onResumeRequired,
  ...props
}: PracticeSessionProps & {
  examId: Id;
  resumeApproved: boolean;
  onResumeRequired: () => void;
}) {
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
    async (isCurrent: () => boolean, idempotencyKey?: string) => {
      const restored = await loadTitleExamResume(
        api,
        examId,
        content.id,
        isCurrent,
        idempotencyKey,
      );
      // A recording may have appeared in another tab since the entry lookup.
      if (
        !resumeApproved &&
        (restored.attempts.length > 0 || restored.phase === "analyzing")
      ) {
        if (isCurrent()) onResumeRequired();
        throw new ApiError(
          "이전 시험 기록의 진행 방법을 선택해 주세요.",
          409,
          "TITLE_EXAM_RESUME_REQUIRED",
        );
      }
      return restored;
    },
    [examId, content.id, resumeApproved, onResumeRequired],
  );
  const submitResult = useCallback(
    async (analysisId: Id) => {
      if (submitBusyRef.current) return;
      analysisIdRef.current = analysisId;
      submitBusyRef.current = true;
      setSubmitting(true);
      setResult(null);
      setError(null);
      const isCurrent = () =>
        mountedRef.current && authEpochRef.current === getAuthSessionVersion();
      try {
        const graded = validateTitleExamResult(
          await api.users.submitTitleExam(examId, analysisId),
        );
        if (!isCurrent()) return;
        setResult(graded);
        // Completion is cached before grading; only a real promotion changes it again.
        if (graded.status === "PASSED") invalidateLearningCaches();
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
        completionReady: !submitting && result !== null && !error,
        completionLabel: submitting
          ? "승급 시험 채점 중…"
          : "승급 채점 확인 필요",
        renderErrorDetails: renderTitleExamErrorDetails,
        resultSummary: (
          <>
            {submitting && (
              <p role="status" className="text-sm text-muted-foreground">
                학습 저장을 완료했습니다. 승급 시험을 채점하고 있어요.
              </p>
            )}
            {result && (
              <section
                className={`design-card border ${result.status === "PASSED" ? "border-[#84dfb7] bg-[#effcf6]" : "border-[#ffc4b8] bg-[#fff5f2]"}`}
                aria-label="승급 시험 결과"
              >
                <p className="text-xs font-semibold text-[#6b7684]">
                  승급 시험 {result.score}점 · 합격 기준 {result.passingScore}점
                </p>
                <h2 className="mt-2 text-xl font-bold">
                  {result.status === "PASSED"
                    ? `${result.currentTitle} 칭호로 승급했어요!`
                    : "아쉽게도 이번에는 불합격이에요"}
                </h2>
                <p className="mt-2 text-sm text-[#6b7684]">
                  {result.status === "PASSED"
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
