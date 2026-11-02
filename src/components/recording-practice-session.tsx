"use client";
import { ReportSaveDialog } from "@/components/report-save-dialog";
import { reportSaves } from "@/lib/report-saves";
import { MicrophonePermissionNotice } from "./microphone-permission-notice";
import { LoadingOverlay } from "./loading-overlay";
import { loadPracticeResume } from "@/lib/practice-resume";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { prepareAudioForAnalysis } from "@/hooks/use-audio-recorder";
import { usePracticeRecorder } from "@/hooks/use-practice-recorder";
import {
  api,
  type AnalysisCapabilities,
  type AnalysisResult,
  type AnalysisSegment,
  type Id,
  type PracticeContent,
  type PracticeExamples,
  type VoiceRecording,
  type CourseDetail,
} from "@/lib/api";
import { SentenceRecordingControls } from "./sentence-recording-controls";
import { SentenceReader } from "@/components/sentence-reader";
import { ReferencePlayer } from "@/components/reference-player";
import { AnalysisView } from "@/components/analysis-view";
import { PracticeAnalysisLoading } from "./practice-analysis-loading";
import { courseResultProgress } from "@/lib/course-result-progress";
import { classPracticeHref } from "@/lib/class-practice";
import { safeInternalPath } from "@/lib/navigation";
import {
  AnalysisConnectionUnavailable,
  AnalysisWaitTimeout,
} from "@/lib/analysis-polling";
import { waitForCanonicalResult } from "@/lib/canonical-result-wait";
import {
  analysisAdmissionMissing,
  analysisRequestWasRejected,
  canRecheckSubmittedAnalysis,
} from "@/lib/canonical-recovery";
import {
  describePracticeError,
  PracticeInputError,
} from "@/lib/practice-error";
import { cn } from "@/lib/utils";
import { ApiError, getAuthSessionVersion } from "@/lib/api/client";
import { canonicalApi } from "@/lib/api/canonical";
import { requireAnalysisScope } from "@/lib/api/analysis-capabilities";
import { voiceProcessingConsentInput } from "@/lib/analysis-consent";
import {
  awaitCanonicalPersistence,
  completeCanonicalPractice,
  invalidatesCanonicalResult,
  resultStillPending,
} from "@/lib/canonical-persistence";
import {
  CanonicalResultUnavailable,
  canonicalPresentation,
} from "@/lib/canonical-presentation";
import { splitSentences } from "@/lib/sentences";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { uploadRecordingWithFreshUrl } from "@/lib/recording-upload";
import { cacheResources } from "@/lib/cache-resources";
import {
  CLIENT_CACHE_LIVE_MAX_AGE_MS,
  readUserClientCache,
  writeUserClientCache,
} from "@/lib/client-cache";
import { invalidateLearningCaches } from "@/lib/learning-cache";
import type { SentenceAnalysisAdmission } from "@/lib/sentence-sequence";
import { assertCoachingInput } from "@/lib/coaching-usage";
import { CoachingUsageSummary } from "./coaching-usage-summary";

type Phase =
  | "idle"
  | "restoring"
  | "recording"
  | "review"
  | "uploading"
  | "analyzing"
  | "result"
  | "error";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function savingResult(result: AnalysisResult | null) {
  return ["SAVING", "RETRYING"].includes(
    result?.canonical?.persistenceStatus ?? "",
  );
}

export type PracticeSessionProps = {
  content: PracticeContent;
  courseExamples?: PracticeExamples | null;
  courseExampleIndex?: number | null;
  localOnly?: boolean;
  onTitleChange?: (title: string) => void;
  experienceLabel?: string;
};

/** Optional session lifecycle supplied by a specialized practice experience. */
export type PracticeSessionWorkflow = {
  createSession: () => Promise<Id>;
  restoreSession: (
    isCurrent: () => boolean,
  ) => ReturnType<typeof loadPracticeResume>;
  onComplete: (analysisId: Id) => Promise<void>;
  learningFocus: PracticeContent["learningFocus"];
  // null delegates authorization to the specialized session endpoints.
  analysisScope: Parameters<typeof requireAnalysisScope>[0] | null;
  title: string;
  resultTitle: string;
  restoringLabel: string;
  completionHref: string;
  resultSummary: ReactNode;
  renderErrorDetails: (reason: unknown) => ReactNode;
};

export function RecordingPracticeSession({
  content,
  courseExamples = null,
  courseExampleIndex = null,
  onTitleChange,
  localOnly = false,
  experienceLabel,
  workflow,
  sentenceIndex,
  onAnalysisAdmitted,
  autoSubmit = false,
  capturedRecording,
  background = false,
  submissionRetry = 0,
  onSubmissionError,
}: PracticeSessionProps & {
  workflow?: PracticeSessionWorkflow;
  sentenceIndex?: number;
  onAnalysisAdmitted?: (admission: SentenceAnalysisAdmission) => void;
  autoSubmit?: boolean;
  capturedRecording?: { blob: Blob; durationMs: number; previewUrl?: string };
  background?: boolean;
  submissionRetry?: number;
  onSubmissionError?: (message: string, reason?: unknown) => void;
}) {
  const router = useRouter();
  const [saveReportOpen, setSaveReportOpen] = useState(false);
  const searchParams = useSearchParams();
  const resumedSessionId = localOnly ? null : searchParams.get("sessionId");
  const resumeType = searchParams.get("resumeType");
  const restoreSession = workflow?.restoreSession;
  // Exam IDs own the current session link. A fresh exam URL has no sessionId,
  // even after its first analysis, so resolve specialized workflows on every entry.
  const needsSessionRestore = Boolean(resumedSessionId || restoreSession);
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [courseFinished, setCourseFinished] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [resultAudioUrl, setResultAudioUrl] = useState<string | undefined>();
  const [resumedRecording, setResumedRecording] =
    useState<VoiceRecording | null>(null);
  const [resumedScriptText, setResumedScriptText] = useState<string | null>(
    null,
  );
  const displayedContent =
    resumedScriptText == null
      ? content
      : { ...content, scriptText: resumedScriptText };
  const [phase, setPhase] = useState<Phase>(
    needsSessionRestore ? "restoring" : capturedRecording ? "review" : "idle",
  );
  const [resumeFailed, setResumeFailed] = useState(false);
  const [resumeRetry, setResumeRetry] = useState(0);
  const resumePendingRef = useRef(needsSessionRestore);
  const [sessionId, setSessionId] = useState<Id | null>(resumedSessionId);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [segments, setSegments] = useState<AnalysisSegment[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [connectionRecovering, setConnectionRecovering] = useState(false);
  const analysisPollRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      analysisPollRef.current?.abort();
    };
  }, []);
  const [requestFailure, setRequestFailure] = useState<unknown>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [canRetryAnalysis, setCanRetryAnalysis] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [recordingAttempts, setRecordingAttempts] = useState<VoiceRecording[]>(
    [],
  );
  const [canCheckAnalysis, setCanCheckAnalysis] = useState(false);
  const [activeSentence, setActiveSentence] = useState(0);
  const sentenceBoundaries = useRef<number[]>([0]);
  const analysisPendingRef = useRef(resumeType === "ANALYSIS_STATUS");
  const waitingAnalysisRef = useRef<Id | undefined>(undefined);
  const sessionIdRef = useRef<Id | null>(resumedSessionId);
  const authEpochRef = useRef(getAuthSessionVersion());
  const selectedRecordingRef = useRef<Id | null>(null);
  const submissionBusyRef = useRef(false);
  const autoSubmittedBlobRef = useRef<Blob | null>(null);
  const uploadedRecordingRef = useRef<{
    source: Blob;
    sessionId: Id;
    recordingId: Id;
    epoch: number;
  } | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const completedRef = useRef(resumeType === "ANALYSIS_RESULT");
  const capabilitiesRef = useRef<AnalysisCapabilities | null>(null);
  const sentences =
    sentenceIndex != null
      ? [displayedContent.scriptText]
      : splitSentences(displayedContent.scriptText);
  const localRecorder = usePracticeRecorder(sentences.length);
  const recorder = capturedRecording
    ? { ...localRecorder, ...capturedRecording, status: "recorded" as const }
    : localRecorder;
  const reviewAudioUrl = recorder.previewUrl;
  const reviewRecordingId = recorder.blob
    ? undefined
    : (resumedRecording?.recordingId ?? resumedRecording?.id);
  const reviewDurationMs = recorder.blob
    ? recorder.durationMs
    : (resumedRecording?.durationMs ?? 0);
  const retryOwner = useRef(submissionRetry);
  const submissionErrorOwner = useRef(onSubmissionError);
  submissionErrorOwner.current = onSubmissionError;
  useEffect(() => {
    if (background && requestError)
      submissionErrorOwner.current?.(requestError, requestFailure);
  }, [background, requestError, requestFailure]);
  useEffect(() => {
    if (!capturedRecording) {
      setActiveSentence(localRecorder.sentenceIndex);
      sentenceBoundaries.current = localRecorder.boundaries;
    }
  }, [
    capturedRecording,
    localRecorder.sentenceIndex,
    localRecorder.boundaries,
  ]);
  const shouldConfirmExit =
    !background &&
    phase !== "result" &&
    !showCompletion &&
    (sentences.length > 1 ||
      phase === "recording" ||
      phase === "review" ||
      phase === "uploading" ||
      phase === "analyzing" ||
      recorder.status === "requesting" ||
      recorder.blob != null ||
      recordingAttempts.length > 0);
  const discardGuard = useRecordingDiscardGuard(shouldConfirmExit, !background);
  const confirmDiscard = discardGuard.request;

  const courseId = searchParams.get("courseId");
  const courseStepId = searchParams.get("courseStepId");
  const resolvedCourseStepId = courseExamples?.stepId ?? courseStepId;
  const currentCourseExample =
    courseExamples && courseExampleIndex != null
      ? courseExamples.items[courseExampleIndex]
      : null;
  const courseSentenceCount = courseExamples?.items.length ?? null;
  const isLastCourseSentence =
    courseSentenceCount != null &&
    courseExampleIndex != null &&
    courseExampleIndex === courseSentenceCount - 1;
  const analysisLearningFocus =
    workflow?.learningFocus ??
    ((currentCourseExample?.focus ?? content.learningFocus) === "BOTH"
      ? "PRONUNCIATION"
      : (currentCourseExample?.focus ?? content.learningFocus));

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    api.courses
      .get(courseId)
      .then((value) => {
        if (active) setCourseDetail(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [courseId]);
  useEffect(() => {
    onTitleChange?.(
      phase === "result"
        ? (workflow?.resultTitle ?? "피드백")
        : phase === "analyzing"
          ? "분석 중"
          : (workflow?.title ?? "연습하기"),
    );
  }, [phase, onTitleChange, workflow?.title, workflow?.resultTitle]);

  useEffect(() => {
    if (phase !== "result" || recorder.previewUrl) return;
    const recording = recordingAttempts.find((item) => item.selected);
    const recordingId = recording?.recordingId ?? recording?.id;
    if (recordingId == null) return;
    let active = true;
    api.training
      .getRecordingPlaybackUrl(recordingId)
      .then((value) => {
        if (active) setResultAudioUrl(value.playbackUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [phase, recorder.previewUrl, recordingAttempts]);

  useEffect(() => {
    phaseRef.current = phase;
    if (recorder.status === "recorded" && phase === "recording") {
      if (activeSentence < sentences.length - 1) {
        setRequestError(
          "모든 문장을 마치기 전에 녹음이 종료되었습니다. 녹음 시간 제한을 확인하고 처음부터 다시 녹음해 주세요.",
        );
        setPhase("error");
      } else {
        setPhase("review");
      }
    }
    if (
      ["denied", "unsupported", "error"].includes(recorder.status) &&
      phase === "recording"
    ) {
      setPhase("error");
    }
  }, [phase, recorder.status, activeSentence, sentences.length]);

  useEffect(() => {
    if (
      !autoSubmit ||
      (!capturedRecording && phase !== "review") ||
      recorder.status !== "recorded" ||
      !recorder.blob ||
      (autoSubmittedBlobRef.current === recorder.blob &&
        retryOwner.current === submissionRetry)
    )
      return;
    // One automatic attempt per captured sentence. A failure needs an explicit retry.
    autoSubmittedBlobRef.current = recorder.blob;
    retryOwner.current = submissionRetry;
    void analyze();
    // The captured blob owns this submission; status/progress renders must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoSubmit,
    phase,
    recorder.status,
    recorder.blob,
    capturedRecording,
    submissionRetry,
  ]);

  useEffect(
    () => () => {
      analysisPollRef.current?.abort();
      const activeSessionId = sessionIdRef.current;
      if (
        activeSessionId &&
        authEpochRef.current === getAuthSessionVersion() &&
        !completedRef.current &&
        !resumePendingRef.current &&
        !analysisPendingRef.current &&
        phaseRef.current !== "analyzing"
      ) {
        void api.training.cancel(activeSessionId).catch(() => undefined);
      }
    },
    [],
  );

  useEffect(() => {
    if (!resumedSessionId && !restoreSession) return;

    let active = true;
    let resumeReadComplete = false;
    resumePendingRef.current = true;
    setResumeFailed(false);
    setPhase("restoring");

    void (async () => {
      try {
        const restored = restoreSession
          ? await restoreSession(() => active)
          : await loadPracticeResume(api, resumedSessionId!, content.id);
        if (!active) return;
        resumeReadComplete = true;
        resumePendingRef.current = false;
        sessionIdRef.current = restored.sessionId;
        setSessionId(restored.sessionId);
        setResumedScriptText(restored.scriptText ?? null);
        completedRef.current = restored.completed;
        selectedRecordingRef.current = restored.selectedRecordingId;
        setRecordingAttempts(restored.attempts);
        analysisPendingRef.current = restored.phase === "analyzing";
        setRequestFailure(null);
        setRequestError(null);
        setCanCheckAnalysis(false);
        if (restored.phase === "idle") {
          const priorRecording =
            restoreSession && restored.sessionId != null
              ? (restored.attempts.find((item) => item.selected) ??
                [...restored.attempts].sort(
                  (a, b) => b.attemptNo - a.attemptNo,
                )[0])
              : undefined;
          setResumedRecording(priorRecording ?? null);
          setPhase(priorRecording ? "review" : "idle");
          return;
        }
        setPhase("analyzing");
        if (restored.sessionId == null)
          throw new Error("이어갈 학습 세션을 확인하지 못했습니다.");
        const deliveredResult = await waitForAnalysis(restored.sessionId);
        if (!active) return;
        await loadResult(
          restored.sessionId,
          deliveredResult.id,
          deliveredResult,
        );
      } catch (reason) {
        if (!active) return;
        setResumeFailed(!resumeReadComplete);
        setRequestFailure(reason);
        setCanRetryAnalysis(
          reason instanceof CanonicalResultUnavailable &&
            reason.view.actions.canRetry,
        );
        setCanCheckAnalysis(
          resumeReadComplete &&
            selectedRecordingRef.current != null &&
            canRecheckSubmittedAnalysis(reason),
        );
        setRequestError(
          reason instanceof Error
            ? reason.message
            : "진행하던 학습을 불러오지 못했습니다.",
        );
        setPhase("error");
      }
    })();

    return () => {
      active = false;
      analysisPollRef.current?.abort();
    };
  }, [content.id, resumeType, resumedSessionId, restoreSession, resumeRetry]);

  async function ensureSession() {
    if (sessionId) return sessionId;
    if (workflow) {
      const createdId = await workflow.createSession();
      setSessionId(createdId);
      sessionIdRef.current = createdId;
      return createdId;
    }
    const session = await api.training.create({
      contentId: content.id,
      courseStepId: resolvedCourseStepId || null,
      titleExamId: null,
      learningFocus: analysisLearningFocus,
      ...(sentenceIndex != null && {
        sentenceIndex,
        sentenceText: content.scriptText,
      }),
    });
    const createdId = session.sessionId ?? session.id;
    if (createdId == null) throw new Error("학습 세션 ID가 응답에 없습니다.");
    setSessionId(createdId);
    sessionIdRef.current = createdId;
    return createdId;
  }

  async function getAnalysisCapabilities() {
    if (workflow?.analysisScope !== null)
      await requireAnalysisScope(
        workflow?.analysisScope ??
          (courseId ||
          resolvedCourseStepId ||
          content.contentType === "CLASS_PRACTICE"
            ? "COURSE"
            : "STANDALONE_AUDIO"),
      );
    if (capabilitiesRef.current) return capabilitiesRef.current;
    const userId = getAuthenticatedUserId();
    const capabilities =
      readUserClientCache<AnalysisCapabilities>(
        userId,
        cacheResources.analysisCapabilities,
        CLIENT_CACHE_LIVE_MAX_AGE_MS,
      ) ?? (await api.training.getAnalysisCapabilities());
    writeUserClientCache(
      userId,
      cacheResources.analysisCapabilities,
      capabilities,
    );
    if (
      capabilities.recordingUpload !== "CONFIGURED" ||
      capabilities.analysisRequests !== "CONFIGURED"
    ) {
      throw new PracticeInputError(
        "unsupported",
        "현재 서버의 음성 분석 기능을 사용할 수 없습니다.",
      );
    }
    if (
      !capabilities.supportedLearningFocuses.includes(analysisLearningFocus)
    ) {
      throw new PracticeInputError(
        "unsupported",
        analysisLearningFocus === "INTONATION"
          ? "현재 AI 분석은 발음 연습만 지원합니다. 억양 분석은 준비 중입니다."
          : "이 연습 유형은 현재 AI 분석에서 지원하지 않습니다.",
      );
    }
    capabilitiesRef.current = capabilities;
    return capabilities;
  }

  async function getConsentInput() {
    return voiceProcessingConsentInput(await getAnalysisCapabilities());
  }

  async function startRecording() {
    // Local capture must retain the tap's activation and work independently of
    // server analysis availability. Check remote support before sending audio.
    recorder.unlockAudio();
    sentenceBoundaries.current = [0];
    setActiveSentence(0);
    setRequestError(null);
    setRequestFailure(null);
    try {
      const started = await recorder.start();
      if (started) setPhase("recording");
      else setPhase("error");
    } catch (reason) {
      setRequestFailure(reason);
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "녹음을 시작하지 못했습니다.",
      );
      setPhase("error");
    }
  }

  async function waitForAnalysis(activeSessionId: Id, expectedAnalysisId?: Id) {
    waitingAnalysisRef.current = expectedAnalysisId;
    if (!mountedRef.current)
      throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
    analysisPollRef.current?.abort();
    const controller = new AbortController();
    analysisPollRef.current = controller;
    setConnectionRecovering(false);
    analysisPendingRef.current = true;
    setCanCheckAnalysis(false);
    try {
      if (selectedRecordingRef.current == null)
        throw new Error("선택한 녹음을 확인할 수 없습니다.");
      return await waitForCanonicalResult({
        sessionId: activeSessionId,
        recordingId: selectedRecordingRef.current,
        analysisId: expectedAnalysisId,
        signal: controller.signal,
        onConnectionChange: setConnectionRecovering,
        onProgress: setAnalysisProgress,
      });
    } catch (reason) {
      if (controller.signal.aborted) throw reason;
      if (
        reason instanceof AnalysisConnectionUnavailable ||
        reason instanceof AnalysisWaitTimeout
      )
        waitingAnalysisRef.current = reason.analysisId ?? expectedAnalysisId;
      setRequestFailure(reason);
      setCanRetryAnalysis(
        reason instanceof CanonicalResultUnavailable &&
          reason.view.actions.canRetry,
      );
      setCanCheckAnalysis(canRecheckSubmittedAnalysis(reason));
      throw reason;
    } finally {
      if (analysisPollRef.current === controller)
        analysisPollRef.current = null;
    }
  }

  async function checkExistingAnalysis() {
    if (!sessionId) return;
    setRequestError(null);
    setRequestFailure(null);
    setCanCheckAnalysis(false);
    setPhase("analyzing");
    try {
      if (waitingAnalysisRef.current == null) {
        const current = await api.training.get(sessionId);
        if (analysisAdmissionMissing(current)) {
          analysisPendingRef.current = false;
          setCanCheckAnalysis(false);
          setPhase(recorder.blob ? "review" : "idle");
          setRequestError(
            "분석 요청이 접수되지 않았어요. 녹음은 유지되어 있으니 다시 분석해 주세요.",
          );
          return;
        }
      }
      if (onAnalysisAdmitted && selectedRecordingRef.current != null) {
        // A status read confirms a lost acknowledgement without waiting for AI completion.
        const status = await canonicalApi.status(sessionId);
        if (
          waitingAnalysisRef.current != null &&
          String(waitingAnalysisRef.current) !== String(status.analysisId)
        )
          throw new ApiError(
            "분석 시도가 변경되었습니다.",
            409,
            "CANONICAL_ATTEMPT_CHANGED",
          );
        onAnalysisAdmitted({
          sessionId,
          recordingId: selectedRecordingRef.current,
          analysisId: status.analysisId,
        });
        return;
      }
      const result = await waitForAnalysis(
        sessionId,
        waitingAnalysisRef.current,
      );
      await loadResult(sessionId, result.id, result);
    } catch (reason) {
      setRequestFailure(reason);
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "분석 상태를 확인하지 못했습니다.",
      );
      setPhase("error");
    }
  }

  async function waitForRecordingQuality(activeSessionId: Id, recordingId: Id) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const recordings = await api.training.listRecordings(activeSessionId);
      setRecordingAttempts(recordings);
      const recording = recordings.find(
        (item) => String(item.recordingId ?? item.id) === String(recordingId),
      );
      if (recording?.qualityStatus === "PASS") return recording;
      if (recording && recording.qualityStatus !== "PENDING") {
        throw new PracticeInputError(
          "quality",
          `음질 검사를 통과하지 못했습니다: ${recording.qualityStatus}`,
        );
      }
      await wait(1_000);
    }
    throw new PracticeInputError(
      "preparation",
      "음질 검사 처리가 지연되고 있습니다. 소리가 작다는 의미는 아닙니다.",
    );
  }

  async function readResult(analysisId: Id, delivered?: AnalysisResult) {
    if (selectedRecordingRef.current == null)
      throw new Error("선택한 녹음을 확인할 수 없습니다.");
    if (
      delivered &&
      (String(delivered.id) !== String(analysisId) ||
        String(delivered.canonical?.recordingId) !==
          String(selectedRecordingRef.current))
    )
      throw new ApiError(
        "분석 시도가 변경되었습니다.",
        409,
        "CANONICAL_ATTEMPT_CHANGED",
      );
    const result =
      delivered ??
      (await api.analyses.get(analysisId, selectedRecordingRef.current));
    if (
      result.canonical &&
      (result.canonical.jobStatus === "FAILED" ||
        result.canonical.canonicalAnalysis?.decision.status !== "ACCEPT") &&
      !savingResult(result)
    )
      throw new CanonicalResultUnavailable(result.canonical);
    return result;
  }

  async function loadResult(
    activeSessionId: Id,
    analysisId: Id,
    delivered?: AnalysisResult,
  ) {
    const authVersion = getAuthSessionVersion();
    const result = await readResult(analysisId, delivered);
    if (!mountedRef.current || authVersion !== getAuthSessionVersion()) return;
    if (onAnalysisAdmitted && selectedRecordingRef.current != null) {
      // A lost POST acknowledgement was recovered by reading the same analysis.
      onAnalysisAdmitted({
        sessionId: activeSessionId,
        recordingId: selectedRecordingRef.current,
        analysisId,
      });
      return;
    }
    const segmentPage = { items: [] };
    setAnalysis(result);
    setSegments(segmentPage.items);
    // Results become visible before database persistence and learning completion.
    setPhase("result");
    if (savingResult(result)) {
      analysisPendingRef.current = true;
      return;
    }
    if (!result.canonical?.actions.canComplete) {
      analysisPendingRef.current = false;
      setRequestError(
        "분석 결과는 준비됐지만 학습 완료를 확인할 수 없습니다. 현재 결과를 다시 확인해 주세요.",
      );
      return;
    }
    try {
      await completeCanonicalPractice(
        api,
        activeSessionId,
        result.canonical,
        () => mountedRef.current && authVersion === getAuthSessionVersion(),
      );
    } catch (error) {
      if (!mountedRef.current || authVersion !== getAuthSessionVersion())
        return;
      if (invalidatesCanonicalResult(error)) {
        setAnalysis(null);
        throw error;
      }
      setRequestError(
        "분석 결과는 준비됐지만 학습 완료를 확인하지 못했습니다. 완료 상태를 다시 확인해 주세요.",
      );
      return;
    }
    if (!mountedRef.current || authVersion !== getAuthSessionVersion()) return;
    setRequestError(null);
    invalidateLearningCaches();
    completedRef.current = true;
    analysisPendingRef.current = false;

    // A course-level example set contains several independent sentence sessions.
    // Only the last sentence may advance the class itself.
    if (courseId && resolvedCourseStepId && !courseExamples) {
      const [steps, currentProgress] = await Promise.all([
        api.courses.getSteps(courseId),
        api.courses.getProgress(courseId),
      ]);
      const update = courseResultProgress(
        steps,
        currentProgress,
        resolvedCourseStepId,
      );
      const { progressPercent } = update;
      await api.courses.updateProgress(courseId, update);
      if (progressPercent >= 100) {
        await api.courses.complete(courseId);
        setCourseFinished(true);
      }
    }
    await workflow?.onComplete(analysisId);
    setPhase("result");
  }

  useEffect(() => {
    const view = analysis?.canonical;
    if (phase !== "result" || !sessionId || !view || !savingResult(analysis))
      return;
    const owner = new AbortController();
    const epoch = getAuthSessionVersion();
    void awaitCanonicalPersistence(view, owner.signal, (current) => {
      if (owner.signal.aborted || epoch !== getAuthSessionVersion()) return;
      // A pending recovery snapshot has no result; keep the same attempt's preview read-only.
      if (current.canonicalAnalysis || current.serviceFailure)
        setAnalysis(canonicalPresentation(current));
      else
        setRequestError(
          "저장 상태를 다시 확인하고 있습니다. 분석을 다시 요청할 필요는 없습니다.",
        );
    })
      .then(async (current) => {
        if (!owner.signal.aborted && epoch === getAuthSessionVersion())
          await loadResult(
            sessionId,
            current.analysisId,
            canonicalPresentation(current),
          );
      })
      .catch((error) => {
        if (owner.signal.aborted || epoch !== getAuthSessionVersion()) return;
        if (
          error instanceof CanonicalResultUnavailable ||
          invalidatesCanonicalResult(error)
        ) {
          setAnalysis(null);
          setRequestFailure(error);
          setPhase("error");
          setRequestError(error.message);
        } else {
          setRequestError(
            "분석 결과는 준비됐지만 저장 확인이 지연되고 있습니다. 저장 상태를 다시 확인해 주세요.",
          );
        }
      });
    return () => owner.abort();
    // The full attempt identity scopes the observer; rendering a fresh snapshot does not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    sessionId,
    analysis?.canonical?.analysisId,
    analysis?.canonical?.requestId,
    analysis?.canonical?.executionId,
  ]);

  async function refreshResult() {
    const view = analysis?.canonical;
    if (!view || !sessionId) return;
    const epoch = getAuthSessionVersion();
    try {
      const current = await canonicalApi.get(view);
      if (!mountedRef.current || epoch !== getAuthSessionVersion()) return;
      if (resultStillPending(current)) {
        setRequestError(
          "기존 결과의 저장 상태를 다시 확인하고 있습니다. 잠시 후 다시 확인해 주세요.",
        );
        return;
      }
      await loadResult(
        sessionId,
        current.analysisId,
        canonicalPresentation(current),
      );
    } catch (error) {
      if (!mountedRef.current || epoch !== getAuthSessionVersion()) return;
      if (
        error instanceof CanonicalResultUnavailable ||
        invalidatesCanonicalResult(error)
      ) {
        setAnalysis(null);
        setRequestFailure(error);
        setPhase("error");
      }
      setRequestError(
        error instanceof Error
          ? error.message
          : "결과를 다시 확인하지 못했습니다.",
      );
    }
  }

  async function analyze() {
    if (
      submissionBusyRef.current ||
      !mountedRef.current ||
      authEpochRef.current !== getAuthSessionVersion()
    )
      return;
    const assertOwner = () => {
      if (
        !mountedRef.current ||
        authEpochRef.current !== getAuthSessionVersion()
      )
        throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
    };
    // Once submitted (including a lost acknowledgement), recover by reading.
    // Never issue another upload against an ANALYZING session.
    if (analysisPendingRef.current && sessionIdRef.current) {
      await checkExistingAnalysis();
      return;
    }
    const savedRecording = !recorder.blob ? resumedRecording : null;
    if (!recorder.blob && !savedRecording) return;
    if (localOnly) {
      setRequestError(
        "내 문장은 서버 콘텐츠 ID가 없어 AI 분석을 요청할 수 없습니다.",
      );
      return;
    }
    submissionBusyRef.current = true;
    let awaitingAdmission = false;
    let checkingAvailability = true;
    setRequestError(null);
    setRequestFailure(null);
    setCanRetryAnalysis(false);
    setCanCheckAnalysis(false);
    setUploadProgress(0);
    setPhase("uploading");
    try {
      assertCoachingInput(displayedContent.scriptText, recorder.durationMs);
      const capabilities = await getAnalysisCapabilities();
      assertOwner();
      checkingAvailability = false;
      let activeSessionId: Id;
      let recordingId: Id | null;
      if (savedRecording && sessionIdRef.current != null) {
        // Resume an already registered recording only after the user explicitly
        // requests analysis. Do not download/re-upload or auto-submit on entry.
        activeSessionId = sessionIdRef.current;
        recordingId = savedRecording.recordingId ?? savedRecording.id ?? null;
        if (recordingId == null)
          throw new Error("이전 녹음 ID를 확인하지 못했습니다.");
      } else {
        if (!recorder.blob)
          throw new Error("분석할 녹음을 확인하지 못했습니다.");
        if (recorder.durationMs < capabilities.minimumDurationMs) {
          throw new PracticeInputError(
            "input",
            `분석하려면 ${Math.ceil(capabilities.minimumDurationMs / 1_000)}초 이상 녹음해 주세요.`,
          );
        }
        if (recorder.durationMs > capabilities.maximumDurationMs) {
          throw new PracticeInputError(
            "input",
            `녹음은 ${Math.floor(capabilities.maximumDurationMs / 1_000)}초 이내여야 합니다.`,
          );
        }
        const prepared = await prepareAudioForAnalysis(
          recorder.blob,
          capabilities.acceptedAudioMimeTypes,
        ).catch((reason: unknown) => {
          throw new PracticeInputError(
            "preparation",
            reason instanceof Error
              ? reason.message
              : "오디오 변환에 실패했습니다.",
          );
        });
        if (prepared.blob.size > capabilities.maximumAudioUploadBytes) {
          throw new PracticeInputError(
            "input",
            "녹음 파일이 서버의 업로드 제한을 초과했습니다.",
          );
        }
        assertOwner();
        activeSessionId = await ensureSession();
        assertOwner();
        setPhase("uploading");
        const previousUpload = uploadedRecordingRef.current;
        recordingId =
          previousUpload?.source === recorder.blob &&
          String(previousUpload.sessionId) === String(activeSessionId) &&
          previousUpload.epoch === getAuthSessionVersion()
            ? previousUpload.recordingId
            : null;
        if (recordingId == null) {
          const uploadInput = {
            fileName: `recording-${Date.now()}.${prepared.extension}`,
            mimeType: prepared.mimeType,
            fileSizeBytes: prepared.blob.size,
          };
          const uploadInfo = await uploadRecordingWithFreshUrl({
            issueUploadUrl: () => {
              assertOwner();
              return api.training.getUploadUrl(activeSessionId, uploadInput);
            },
            upload: (currentUpload) => {
              assertOwner();
              return api.training.uploadRecording(
                currentUpload,
                prepared.blob,
                setUploadProgress,
              );
            },
            onRetry: () => setUploadProgress(0),
          });
          assertOwner();
          const recording = await api.training.registerRecording(
            activeSessionId,
            {
              objectKey: uploadInfo.objectKey,
              mimeType: prepared.mimeType,
              fileSizeBytes: prepared.blob.size,
              durationMs: recorder.durationMs,
            },
          );
          assertOwner();
          recordingId = recording.recordingId ?? recording.id ?? null;
          if (recordingId == null)
            throw new Error("녹음 ID가 응답에 없습니다.");
          uploadedRecordingRef.current = {
            source: recorder.blob,
            sessionId: activeSessionId,
            recordingId,
            epoch: getAuthSessionVersion(),
          };
        }
      }
      const qualified = await waitForRecordingQuality(
        activeSessionId,
        recordingId,
      );
      assertOwner();
      if (!qualified.selected)
        await api.training.selectRecording(activeSessionId, recordingId);
      selectedRecordingRef.current = recordingId;
      setRecordingAttempts((current) =>
        current.map((item) => ({
          ...item,
          selected: String(item.recordingId ?? item.id) === String(recordingId),
        })),
      );
      assertOwner();
      const consent = await getConsentInput();
      assertOwner();
      waitingAnalysisRef.current = undefined;
      analysisPendingRef.current = true;
      awaitingAdmission = true;
      setCanCheckAnalysis(true);
      const requested = await api.training.analyze(activeSessionId, consent);
      assertOwner();
      awaitingAdmission = false;
      setPhase("analyzing");
      if (onAnalysisAdmitted) {
        onAnalysisAdmitted({
          sessionId: activeSessionId,
          recordingId,
          analysisId: requested.analysisId,
        });
        return;
      }
      const deliveredResult = await waitForAnalysis(
        activeSessionId,
        requested.analysisId,
      );
      await loadResult(activeSessionId, deliveredResult.id, deliveredResult);
    } catch (reason) {
      if (
        !mountedRef.current ||
        authEpochRef.current !== getAuthSessionVersion()
      )
        return;
      if (awaitingAdmission && analysisRequestWasRejected(reason)) {
        analysisPendingRef.current = false;
        setCanCheckAnalysis(false);
      }
      setRequestFailure(reason);
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "음성 분석 요청에 실패했습니다.",
      );
      // Unsupported/unavailable analysis must leave local playback accessible.
      setPhase(checkingAvailability ? "review" : "error");
    } finally {
      submissionBusyRef.current = false;
    }
  }

  async function retryFailedAnalysis() {
    if (!sessionId) return;
    const expected =
      requestFailure instanceof CanonicalResultUnavailable
        ? requestFailure.view
        : undefined;
    setRequestError(null);
    setRequestFailure(null);
    setCanRetryAnalysis(false);
    setAnalysisProgress(0);
    setAnalysis(null);
    setSegments([]);
    analysisPendingRef.current = true;
    setCanCheckAnalysis(true);
    setPhase("analyzing");
    try {
      const requested = await api.training.retryAnalysis(
        sessionId,
        await getConsentInput(),
        expected,
      );
      const deliveredResult = await waitForAnalysis(
        sessionId,
        requested.analysisId,
      );
      await loadResult(sessionId, deliveredResult.id, deliveredResult);
    } catch (reason) {
      if (analysisRequestWasRejected(reason)) {
        analysisPendingRef.current = false;
        setCanCheckAnalysis(false);
      }
      setRequestFailure(reason);
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "음성 분석 재시도에 실패했습니다.",
      );
      setPhase("error");
    }
  }

  async function resetRecording() {
    if (
      analysisPendingRef.current &&
      !(requestFailure instanceof CanonicalResultUnavailable)
    ) {
      await checkExistingAnalysis();
      return;
    }
    try {
      if (requestFailure instanceof CanonicalResultUnavailable) {
        const previous = requestFailure.view;
        const current = await canonicalApi.get({
          analysisId: previous.analysisId,
          recordingId: previous.recordingId,
          requestId: previous.requestId,
          executionId: previous.executionId,
        });
        if (!current.actions.canRerecord)
          throw new CanonicalResultUnavailable(current);
        // Existing backend recovery uses a new recording in the SAME session.
        selectedRecordingRef.current = null;
        analysisPendingRef.current = false;
        completedRef.current = false;
        setAnalysis(null);
        setSegments([]);
      }
      recorder.reset();
      uploadedRecordingRef.current = null;
      setActiveSentence(0);
      setRequestError(null);
      setRequestFailure(null);
      setPhase("idle");
    } catch (reason) {
      setRequestFailure(reason);
      setCanRetryAnalysis(false);
      setCanCheckAnalysis(true);
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "현재 분석 상태를 확인하지 못했습니다.",
      );
    }
  }

  async function goToNextContent() {
    if (localOnly) {
      router.push("/sentences");
      return;
    }
    if (courseId) {
      if (!completedRef.current) {
        setRequestError(
          "현재 문장의 완료 상태를 먼저 확인해 주세요. 결과는 그대로 유지됩니다.",
        );
        return;
      }
      if (courseExamples && courseExampleIndex != null) {
        setLoadingNext(true);
        setRequestError(null);
        setRequestFailure(null);
        try {
          if (!isLastCourseSentence) {
            const returnTo = safeInternalPath(
              searchParams.get("returnTo"),
              "/class",
            );
            router.push(
              classPracticeHref(
                courseExamples,
                courseExampleIndex + 1,
                returnTo,
              ),
            );
            return;
          }

          await api.courses.updateProgress(courseId, {
            lastStepId: courseExamples.stepId,
            progressPercent: 100,
          });
          await api.courses.complete(courseId);
          invalidateLearningCaches();
          setCourseFinished(true);
          setShowCompletion(true);
          onTitleChange?.("클래스 완료");
        } catch (reason) {
          setRequestFailure(reason);
          setRequestError(
            reason instanceof Error
              ? reason.message
              : "현재 문장의 완료 상태를 저장하지 못했습니다. 다시 시도해 주세요.",
          );
          setLoadingNext(false);
        }
        return;
      }
      if (courseFinished) {
        setShowCompletion(true);
        onTitleChange?.("클래스 완료");
      } else
        router.push(
          searchParams.get("returnTo")?.startsWith("/class")
            ? searchParams.get("returnTo")!
            : "/class",
        );
      return;
    }
    setLoadingNext(true);
    setRequestError(null);
    setRequestFailure(null);
    try {
      const next = await api.content.getNext({
        type: content.contentType,
        category: content.category,
        difficulty: content.difficulty,
        excludeId: content.id,
      });
      const returnTo = searchParams.get("returnTo") ?? "/home";
      router.push(
        `/practice/${next.id}?returnTo=${encodeURIComponent(returnTo)}&start=1`,
      );
    } catch (reason) {
      setRequestFailure(reason);
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "다음 콘텐츠를 불러오지 못했습니다.",
      );
      setLoadingNext(false);
    }
  }

  if (background) return null;

  if (phase === "restoring")
    return (
      <>
        {discardGuard.dialog}
        <LoadingOverlay
          label={workflow?.restoringLabel ?? "학습 상태를 확인하고 있어요"}
        />
      </>
    );

  if (phase === "error") {
    const errorView = describePracticeError(requestFailure, recorder.status);
    const quality = errorView.kind === "quality";
    const canonicalFailure =
      requestFailure instanceof CanonicalResultUnavailable
        ? requestFailure.view
        : null;
    const rerecord = canonicalFailure
      ? canonicalFailure.actions.canRerecord
      : quality ||
        errorView.kind === "input" ||
        errorView.kind === "audio" ||
        errorView.kind === "recording";
    const quotaBlocked =
      errorView.kind === "quota" || errorView.kind === "period";
    const scriptBlocked = errorView.kind === "script";
    return (
      <div className="flex min-h-full flex-col px-5 pb-8">
        {discardGuard.dialog}
        <div className="my-auto py-10 text-center">
          <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-[#edf2ff] text-primary">
            <CircleAlert className="size-9" />
          </span>
          <h2 className="mt-6 text-2xl font-bold">{errorView.title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {errorView.hint}
          </p>
          {quality ? (
            <ul className="design-card mt-6 space-y-4 text-left text-sm">
              {[
                "조용한 곳에서 녹음해 주세요",
                "마이크에서 20센티미터 정도 떨어져 주세요",
                "평소 말하는 크기로 읽어 주세요",
              ].map((text) => (
                <li key={text} className="flex gap-3">
                  <Check className="size-4 shrink-0 text-primary" />
                  {text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              {recorder.previewUrl
                ? "녹음한 음성은 그대로 남아 있어요"
                : "학습 기록에서 진행 상태를 확인할 수 있어요"}
            </p>
          )}
          <p
            role="alert"
            className="mt-4 text-xs leading-5 text-muted-foreground"
          >
            {requestError ?? recorder.error}
          </p>
          {recorder.status === "denied" && <MicrophonePermissionNotice />}
          {workflow?.renderErrorDetails(requestFailure)}
          {quotaBlocked && <CoachingUsageSummary compact />}
        </div>
        <button
          className="design-action"
          disabled={
            canonicalFailure != null &&
            !canCheckAnalysis &&
            !canonicalFailure.actions.canRetry &&
            !rerecord
          }
          onClick={() => {
            if (quotaBlocked || scriptBlocked) {
              confirmDiscard("exit", () =>
                router.push(
                  quotaBlocked ? "/mypage/payments?view=manage" : "/sentences",
                ),
              );
              return;
            }
            if (resumeFailed) {
              setResumeRetry((value) => value + 1);
              return;
            }
            if (canonicalFailure?.actions.canRetry) {
              void retryFailedAnalysis();
              return;
            }
            if (canCheckAnalysis && sessionId) {
              void checkExistingAnalysis();
              return;
            }
            if (canRetryAnalysis) {
              void retryFailedAnalysis();
              return;
            }
            if (!rerecord && recorder.blob) {
              void analyze();
              return;
            }
            void resetRecording();
          }}
        >
          {quotaBlocked
            ? "코칭 이용권 확인"
            : scriptBlocked
              ? "다른 문장 선택"
              : resumeFailed
                ? "학습 상태 다시 확인"
                : canCheckAnalysis && sessionId
                  ? "분석 상태 다시 확인"
                  : canRetryAnalysis || canonicalFailure?.actions.canRetry
                    ? "분석 다시 시도"
                    : rerecord
                      ? "다시 녹음하기"
                      : "다시 시도하기"}
        </button>
        <button
          className="mt-4 py-3 text-sm text-muted-foreground"
          onClick={() => router.push("/home")}
        >
          나중에 하기
        </button>
      </div>
    );
  }

  if (showCompletion)
    return (
      <div className="flex min-h-full flex-col px-5 text-center">
        <div className="my-auto py-12">
          <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary text-white">
            <Check className="size-10" />
          </span>
          <h2 className="mt-6 text-2xl leading-9 font-bold">
            {courseDetail?.title ?? "클래스"}를<br />
            완료했어요
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {courseSentenceCount != null
              ? `${courseSentenceCount}개 문장을 모두 마쳤어요`
              : courseDetail
                ? `${courseDetail.stepCount}단계를 모두 마쳤어요`
                : "모든 단계를 마쳤어요"}
          </p>
          <section className="design-card mt-8 grid grid-cols-3 divide-x divide-border !px-2">
            <div>
              <b className="text-xl text-primary">
                {analysis?.overallScore == null
                  ? "—"
                  : `${analysis.overallScore.toFixed(1)}점`}
              </b>
              <p className="mt-2 text-[11px] text-muted-foreground">
                마지막 점수
              </p>
            </div>
            <div>
              <b className="text-xl">
                {Math.max(1, Math.round(recorder.durationMs / 1000))}초
              </b>
              <p className="mt-2 text-[11px] text-muted-foreground">
                이번 연습 시간
              </p>
            </div>
            <div>
              <b className="text-xl">
                {courseSentenceCount ?? courseDetail?.stepCount ?? "—"}개
              </b>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {courseSentenceCount != null ? "완료 문장" : "완료 단계"}
              </p>
            </div>
          </section>
        </div>
        <div className="space-y-3 pb-6">
          <button
            type="button"
            className="design-action"
            onClick={() => router.push("/class")}
          >
            다른 클래스 보기
          </button>
          <button
            type="button"
            className="py-3 text-sm text-muted-foreground"
            onClick={() => router.push("/home")}
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );

  const contentTypeLabel =
    experienceLabel ??
    (content.contentType === "NEWS"
      ? "뉴스 읽기"
      : content.contentType === "ANNOUNCER"
        ? "아나운서 따라 읽기"
        : courseId
          ? "클래스"
          : "문장 연습");
  const formatElapsed = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1_000);
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  };
  const stepProgress =
    phase === "uploading"
      ? Math.min(32, Math.round(uploadProgress / 3))
      : Math.max(34, analysisProgress);

  return (
    <div className="flex min-h-full flex-col bg-[#f2f4f6]">
      {discardGuard.dialog}
      {localOnly && (
        <p className="mx-5 mb-3 rounded-xl bg-[#edf2ff] px-4 py-3 text-xs leading-5 text-[#1f55e0]">
          내 문장 체험 · 녹음은 이 기기에서만 재생됩니다. AI 분석은 서버에
          등록된 연습 콘텐츠에서 이용할 수 있습니다.
        </p>
      )}
      {!localOnly && phase === "idle" && (
        <div className="px-5">
          <CoachingUsageSummary compact />
        </div>
      )}
      {(phase === "idle" || phase === "recording") && (
        <>
          <div className="flex shrink-0 items-center px-5 pt-3 pb-4">
            <span className="rounded-full bg-[#edf2ff] px-2.5 py-[5px] text-[12px] leading-4 font-medium text-[#1f55e0]">
              {contentTypeLabel}
            </span>
            <span className="ml-auto text-[13px] leading-[18px] text-[#8b95a1]">
              {courseSentenceCount != null && courseExampleIndex != null && (
                <span className="mr-2">
                  예문 {courseExampleIndex + 1}/{courseSentenceCount}
                </span>
              )}
              <strong className="font-bold text-[#2f6bff]">
                {activeSentence + 1}
              </strong>
              /{sentences.length} 문장
              {phase !== "recording" && (
                <>
                  <span className="mx-2 inline-block h-2.5 w-px bg-[#dfe3e8]" />
                  약 {Math.max(1, Math.ceil(content.estimatedSeconds / 60))}분
                </>
              )}
            </span>
          </div>
          <SentenceReader
            variant={phase === "recording" ? "recording" : "reader"}
            sentences={sentences}
            pageIndex={activeSentence}
            activeIndex={phase === "recording" ? activeSentence : undefined}
            className={`mx-5 max-h-[clamp(80px,calc(100dvh-380px),400px)] shadow-[0_2px_6px_rgba(23,23,23,0.05)]`}
          />
        </>
      )}

      {phase !== "result" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {(phase === "idle" || phase === "recording") && (
            <SentenceRecordingControls
              paused={recorder.paused}
              onTogglePause={recorder.togglePause}
              recording={phase === "recording"}
              requesting={recorder.status === "requesting"}
              onStart={() => void startRecording()}
              stream={recorder.getStream()}
              contentId={content.id}
              referenceAvailable={
                content.referenceAudioAvailable && sentences.length === 1
              }
              scriptText={sentences[activeSentence] ?? content.scriptText}
              elapsed={formatElapsed(recorder.elapsedMs)}
              busy={recorder.status !== "recording" || recorder.splitting}
              last={activeSentence === sentences.length - 1}
              onComplete={() => {
                void recorder.stop();
              }}
            />
          )}
          {phase === "review" && (reviewAudioUrl || resumedRecording) && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-6">
                <h2 className="text-[20px] leading-7 font-bold text-[#191f28]">
                  녹음을 확인해 주세요
                </h2>
                <p className="mt-2 text-[14px] leading-5 font-medium text-[#6b7584]">
                  {reviewRecordingId != null
                    ? "이전 녹음을 들어 보고 분석을 요청해 주세요"
                    : "문장마다 들어 보고 분석을 요청해 주세요"}
                </p>
                <div className="mt-5 rounded-[20px] bg-white px-2 pt-2 pb-1.5 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
                  {(resumedRecording && !recorder.blob
                    ? [displayedContent.scriptText]
                    : sentences
                  ).map((sentence, index) => (
                    <div
                      key={`${index}-${sentence}`}
                      className="flex items-center gap-2 rounded-xl py-3 pr-2 pl-3"
                    >
                      <p className="min-w-0 flex-1 [overflow-wrap:anywhere] text-[15px] leading-[22px] font-medium text-[#333d4b]">
                        {sentence}
                      </p>
                      <div className="w-28 shrink-0">
                        <ReferencePlayer
                          source={reviewAudioUrl ?? undefined}
                          recordingId={reviewRecordingId}
                          title={
                            reviewRecordingId != null
                              ? "이전 녹음 듣기"
                              : `${index + 1}문장 듣기`
                          }
                          startSeconds={sentenceBoundaries.current[index] ?? 0}
                          endSeconds={
                            reviewRecordingId != null
                              ? undefined
                              : (sentenceBoundaries.current[index + 1] ??
                                reviewDurationMs / 1_000)
                          }
                          buttonTone="neutral"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="shrink-0 px-5 pb-3">
                <ReferencePlayer
                  source={reviewAudioUrl ?? undefined}
                  recordingId={reviewRecordingId}
                  title="전체 듣기"
                  durationSeconds={reviewDurationMs / 1_000}
                  variant="recording"
                />
              </div>
              <div className="shrink-0 border-t border-[#eef0f3] bg-white px-5 pt-3 pb-2">
                {requestError && (
                  <p role="alert" className="mb-2 text-xs text-red-600">
                    {requestError}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResumedRecording(null);
                      setResultAudioUrl(undefined);
                      recorder.reset();
                      setActiveSentence(0);
                      setRequestError(null);
                      setRequestFailure(null);
                      setPhase("idle");
                    }}
                    className="flex h-[52px] items-center justify-center gap-1.5 rounded-full border border-[#e5e8eb] bg-white text-[15px] leading-[22px] font-bold text-[#191f28]"
                  >
                    <Image
                      src="/figma/practice/undo.svg"
                      alt=""
                      width={18}
                      height={18}
                    />
                    전체 다시 녹음
                  </button>
                  <button
                    type="button"
                    onClick={() => void analyze()}
                    className="h-[52px] rounded-full bg-[#2f6bff] text-[15px] leading-[22px] font-bold text-white"
                  >
                    분석 요청
                  </button>
                </div>
              </div>
            </>
          )}

          {(phase === "uploading" || phase === "analyzing") && (
            <PracticeAnalysisLoading
              uploading={phase === "uploading"}
              connectionRecovering={connectionRecovering}
              stepProgress={stepProgress}
            />
          )}

          {requestError && (
            <div className="mx-5 mb-4 text-center">
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-600"
              >
                {requestError}
              </p>
              {canCheckAnalysis && (
                <button
                  type="button"
                  onClick={() => void checkExistingAnalysis()}
                  className="mt-3 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-white"
                >
                  분석 상태 다시 확인
                </button>
              )}
              {canRetryAnalysis && (
                <button
                  type="button"
                  onClick={() => void retryFailedAnalysis()}
                  className="mt-3 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-white"
                >
                  분석 다시 시도
                </button>
              )}
            </div>
          )}
        </div>
      ) : analysis ? (
        <>
          {workflow?.resultSummary}
          {savingResult(analysis) && (
            <p
              role="status"
              className="mx-5 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900"
            >
              {analysis?.canonical?.persistenceStatus === "RETRYING"
                ? "분석 결과는 준비됐습니다. 기록 저장을 다시 시도하고 있습니다."
                : "분석 결과가 준비됐습니다. 기록을 저장하고 있습니다."}{" "}
              화면을 닫아도 저장은 계속됩니다.
            </p>
          )}
          {(savingResult(analysis) || requestError) && (
            <button
              type="button"
              onClick={() => void refreshResult()}
              className="mx-5 min-h-11 rounded-xl border px-4 text-sm font-semibold"
            >
              저장·완료 상태 다시 확인
            </button>
          )}
          <AnalysisView
            analysis={analysis}
            courseMode={Boolean(courseId)}
            segments={segments}
            content={displayedContent}
            recordingUrl={recorder.previewUrl ?? resultAudioUrl}
          />
          {requestError && (
            <p
              role="alert"
              className="rounded-2xl bg-destructive/10 px-4 py-3 text-center text-xs text-destructive"
            >
              {requestError}
            </p>
          )}
          <div className="sticky bottom-0 border-t border-[#e5e8eb] bg-white px-5 py-3">
            {!courseId && !workflow && (
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({ start: "1" });
                  const returnTo = searchParams.get("returnTo");
                  if (returnTo) params.set("returnTo", returnTo);
                  if (resumedSessionId) {
                    router.replace(
                      `/practice/${encodeURIComponent(String(content.id))}?${params}`,
                    );
                    return;
                  }
                  analysisPollRef.current?.abort();
                  sessionIdRef.current = null;
                  setSessionId(null);
                  completedRef.current = false;
                  selectedRecordingRef.current = null;
                  analysisPendingRef.current = false;
                  setAnalysis(null);
                  setSegments([]);
                  setResultAudioUrl(undefined);
                  setRequestError(null);
                  setRequestFailure(null);
                  setActiveSentence(0);
                  recorder.reset();
                  setPhase("idle");
                }}
                className="mb-3 h-14 w-full rounded-full border border-primary text-[16px] font-bold text-primary"
              >
                다시 연습하기
              </button>
            )}
            <button
              type="button"
              disabled={
                loadingNext ||
                (Boolean(courseId || workflow) && savingResult(analysis)) ||
                (Boolean(courseId) && !completedRef.current)
              }
              onClick={() => setSaveReportOpen(true)}
              className="h-14 w-full rounded-full bg-primary text-[16px] leading-6 font-bold text-white disabled:opacity-50"
            >
              {loadingNext
                ? "이동 중…"
                : courseId
                  ? isLastCourseSentence || courseFinished
                    ? "클래스 완료"
                    : courseExamples
                      ? "다음 문장"
                      : "다음 단계"
                  : "완료하기"}
            </button>
            <ReportSaveDialog
              open={saveReportOpen}
              onOpenChange={setSaveReportOpen}
              onConfirm={async (saved) => {
                if (!sessionId)
                  throw new Error("연습 기록을 확인할 수 없습니다.");
                await reportSaves.set("SESSION", sessionId, saved);
                if (courseId) await goToNextContent();
                else router.push(workflow?.completionHref ?? "/home");
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
