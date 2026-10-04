"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Check, CircleAlert } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  prepareAudioForAnalysis,
  useAudioRecorder,
} from "@/hooks/use-audio-recorder";
import {
  api,
  type AnalysisCapabilities,
  type AnalysisResult,
  type AnalysisSegment,
  type Id,
  type PracticeContent,
  type VoiceRecording,
  type CourseDetail,
  type UserTitleExamResult,
} from "@/lib/api";
import { SentenceReader } from "@/components/sentence-reader";
import { ReferencePlayer } from "@/components/reference-player";
import { AnalysisView } from "@/components/analysis-view";
import { AnalysisLoadingMessage } from "@/components/analysis-loading-message";
import { courseResultProgress } from "@/lib/course-result-progress";
import {
  createTitleExamSession,
  titleExamErrorMessage,
} from "@/lib/title-exam";
import {
  pollAnalysis,
  AnalysisConnectionUnavailable,
  AnalysisWaitTimeout,
} from "@/lib/analysis-polling";
import {
  describePracticeError,
  PracticeInputError,
} from "@/lib/practice-error";
import { cn } from "@/lib/utils";
import {
  ApiError,
  getAuthSessionVersion,
  subscribeAuthSession,
} from "@/lib/api/client";
import { canonicalApi } from "@/lib/api/canonical";
import { CanonicalResultUnavailable } from "@/lib/canonical-presentation";
import { splitSentences } from "@/lib/sentences";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { uploadRecordingWithFreshUrl } from "@/lib/recording-upload";
import { cacheResources } from "@/lib/cache-resources";
import {
  CLIENT_CACHE_LIVE_MAX_AGE_MS,
  readUserClientCache,
  removeUserClientCache,
  removeUserClientCacheGroup,
  writeUserClientCache,
} from "@/lib/client-cache";

type Phase =
  | "idle"
  | "recording"
  | "review"
  | "uploading"
  | "analyzing"
  | "result"
  | "error";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function invalidateLearningCaches() {
  const userId = getAuthenticatedUserId();
  removeUserClientCacheGroup(userId, "home-");
  removeUserClientCacheGroup(userId, "mypage-history-");
  removeUserClientCacheGroup(userId, "streak-");
  removeUserClientCacheGroup(userId, "course-catalog-");
  removeUserClientCache(userId, "mypage-overview");
}

export function PracticeSession(props: {
  content: PracticeContent;
  localOnly?: boolean;
  onTitleChange?: (title: string) => void;
  experienceLabel?: string;
}) {
  const epoch = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionVersion,
    () => 0,
  );
  const params = useSearchParams();
  const identity = [
    epoch,
    props.content.id,
    params.get("sessionId"),
    params.get("courseStepId"),
    params.get("titleExamId"),
  ];
  return <PracticeSessionBody key={JSON.stringify(identity)} {...props} />;
}

function PracticeSessionBody({
  content,
  onTitleChange,
  localOnly = false,
  experienceLabel,
}: {
  content: PracticeContent;
  localOnly?: boolean;
  onTitleChange?: (title: string) => void;
  experienceLabel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumedSessionId = localOnly ? null : searchParams.get("sessionId");
  const resumeType = searchParams.get("resumeType");
  const titleExamId = searchParams.get("titleExamId");
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [courseFinished, setCourseFinished] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [resultAudioUrl, setResultAudioUrl] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>("idle");
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
  const [titleExamResult, setTitleExamResult] =
    useState<UserTitleExamResult | null>(null);
  const [titleExamError, setTitleExamError] = useState<string | null>(null);
  const [titleExamSubmitting, setTitleExamSubmitting] = useState(false);
  const titleExamAnalysisId = useRef<Id | null>(null);
  const titleExamSubmitBusy = useRef(false);
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
  const phaseRef = useRef<Phase>("idle");
  const completedRef = useRef(resumeType === "ANALYSIS_RESULT");
  const capabilitiesRef = useRef<AnalysisCapabilities | null>(null);
  const recorder = useAudioRecorder();
  const discardGuard = useRecordingDiscardGuard(
    phase === "recording" ||
      phase === "review" ||
      recorder.status === "requesting",
    true,
  );

  const courseId = searchParams.get("courseId");
  const courseStepId = searchParams.get("courseStepId");
  const analysisLearningFocus =
    titleExamId || content.learningFocus === "BOTH"
      ? "PRONUNCIATION"
      : content.learningFocus;
  const submitTitleExamResult = useCallback(
    async (analysisId: Id) => {
      if (!titleExamId || titleExamSubmitBusy.current) return;
      titleExamAnalysisId.current = analysisId;
      titleExamSubmitBusy.current = true;
      setTitleExamSubmitting(true);
      setTitleExamError(null);
      try {
        const result = await api.users.submitTitleExam(titleExamId, analysisId);
        if (authEpochRef.current !== getAuthSessionVersion()) return;
        setTitleExamResult(result);
        // Completion is cached before grading; promotion must invalidate it again.
        invalidateLearningCaches();
      } catch (reason) {
        setTitleExamError(titleExamErrorMessage(reason));
      } finally {
        titleExamSubmitBusy.current = false;
        setTitleExamSubmitting(false);
      }
    },
    [titleExamId],
  );

  const sentences = splitSentences(content.scriptText);
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
        ? titleExamId
          ? "승급 시험 결과"
          : "피드백"
        : phase === "analyzing"
          ? "분석 중"
          : titleExamId
            ? "승급 시험"
            : "연습하기",
    );
  }, [phase, onTitleChange, titleExamId]);

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

  useEffect(
    () => () => {
      analysisPollRef.current?.abort();
      const activeSessionId = sessionIdRef.current;
      if (
        activeSessionId &&
        authEpochRef.current === getAuthSessionVersion() &&
        !completedRef.current &&
        !analysisPendingRef.current &&
        phaseRef.current !== "analyzing"
      ) {
        void api.training.cancel(activeSessionId).catch(() => undefined);
      }
    },
    [],
  );

  useEffect(() => {
    if (!resumedSessionId) return;

    let active = true;
    setPhase("analyzing");

    void (async () => {
      try {
        const [resumedSession, attempts] = await Promise.all([
          api.training.get(resumedSessionId),
          api.training.listRecordings(resumedSessionId),
        ]);
        if (
          resumedSession.content?.id != null &&
          String(resumedSession.content.id) !== String(content.id)
        ) {
          throw new Error("이어갈 학습과 현재 콘텐츠가 일치하지 않습니다.");
        }
        if (!active) return;
        const selected = attempts.find((item) => item.selected);
        completedRef.current = resumedSession.status === "COMPLETED";
        selectedRecordingRef.current =
          selected?.recordingId ?? selected?.id ?? null;
        setRecordingAttempts(attempts);

        let analysisId: Id;
        try {
          analysisId = await waitForAnalysis(resumedSessionId);
        } catch (reason) {
          if (
            reason instanceof ApiError &&
            reason.status === 404 &&
            reason.code === "ANALYSIS_NOT_FOUND" &&
            ["RECORDING", "UPLOADING"].includes(resumedSession.status)
          ) {
            if (active) setPhase("idle");
            return;
          }
          throw reason;
        }
        if (!active) return;
        const result = await readResult(analysisId);
        if (!active) return;
        const segmentPage = { items: [] };
        if (!active) return;
        setAnalysis(result);
        setSegments(segmentPage.items);
        if (
          resumedSession.status !== "COMPLETED" &&
          result.canonical?.actions.canComplete
        ) {
          const selectedRecording = attempts.find((item) => item.selected);
          const durationSeconds = Math.max(
            1,
            Math.round((selectedRecording?.durationMs ?? 0) / 1_000),
          );
          await api.training.complete(
            resumedSessionId,
            durationSeconds,
            result.canonical,
          );
          invalidateLearningCaches();
          completedRef.current = true;
          analysisPendingRef.current = false;
        }
        analysisPendingRef.current = false;
        if (titleExamId) await submitTitleExamResult(analysisId);
        if (active) setPhase("result");
      } catch (reason) {
        if (!active) return;
        setRequestFailure(reason);
        setCanRetryAnalysis(
          reason instanceof CanonicalResultUnavailable &&
            reason.view.actions.canRetry,
        );
        setCanCheckAnalysis(!(reason instanceof CanonicalResultUnavailable));
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
      analysisPollRef.current?.abort();
    };
  }, [
    content.id,
    resumeType,
    resumedSessionId,
    titleExamId,
    submitTitleExamResult,
  ]);

  async function ensureSession() {
    if (sessionId) return sessionId;
    if (titleExamId) {
      const createdId = await createTitleExamSession(
        api,
        titleExamId,
        content.id,
      );
      setSessionId(createdId);
      sessionIdRef.current = createdId;
      return createdId;
    }
    const session = await api.training.create({
      contentId: content.id,
      courseStepId: courseStepId || null,
      titleExamId: titleExamId || null,
      learningFocus: analysisLearningFocus,
    });
    const createdId = session.sessionId ?? session.id;
    if (createdId == null) throw new Error("학습 세션 ID가 응답에 없습니다.");
    setSessionId(createdId);
    sessionIdRef.current = createdId;
    return createdId;
  }

  async function getAnalysisCapabilities() {
    if (courseId || courseStepId || content.contentType === "CLASS_PRACTICE")
      throw new PracticeInputError(
        "unsupported",
        "현재 서버의 분석 계약은 클래스 분석을 아직 지원하지 않습니다.",
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
    const capabilities = await getAnalysisCapabilities();
    if (!capabilities.consentPolicyRevision) {
      throw new Error("음성 처리 동의 정책 정보를 불러오지 못했습니다.");
    }
    return {
      accepted: true as const,
      policyRevision: capabilities.consentPolicyRevision,
    };
  }

  async function startRecording() {
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
      return await pollAnalysis({
        getStatus: (signal) =>
          api.training.getAnalysisStatus(activeSessionId, signal),
        signal: controller.signal,
        expectedAnalysisId,
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
      setCanCheckAnalysis(
        reason instanceof AnalysisConnectionUnavailable ||
          reason instanceof AnalysisWaitTimeout,
      );
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
      const analysisId = await waitForAnalysis(
        sessionId,
        waitingAnalysisRef.current,
      );
      await loadResult(sessionId, analysisId);
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

  async function readResult(analysisId: Id) {
    if (selectedRecordingRef.current == null)
      throw new Error("선택한 녹음을 확인할 수 없습니다.");
    const result = await api.analyses.get(
      analysisId,
      selectedRecordingRef.current,
    );
    if (result.canonical && !result.canonical.actions.canComplete)
      throw new CanonicalResultUnavailable(result.canonical);
    return result;
  }

  async function loadResult(activeSessionId: Id, analysisId: Id) {
    const result = await readResult(analysisId);
    const segmentPage = { items: [] };
    setAnalysis(result);
    setSegments(segmentPage.items);
    await api.training.complete(
      activeSessionId,
      Math.max(1, Math.round(recorder.durationMs / 1_000)),
      result.canonical,
    );
    invalidateLearningCaches();
    completedRef.current = true;
    analysisPendingRef.current = false;

    if (courseId && courseStepId) {
      const [steps, currentProgress] = await Promise.all([
        api.courses.getSteps(courseId),
        api.courses.getProgress(courseId),
      ]);
      const update = courseResultProgress(steps, currentProgress, courseStepId);
      const { progressPercent } = update;
      await api.courses.updateProgress(courseId, update);
      if (progressPercent >= 100) {
        await api.courses.complete(courseId);
        setCourseFinished(true);
      }
    }
    if (titleExamId) await submitTitleExamResult(analysisId);
    setPhase("result");
  }

  async function analyze() {
    if (!recorder.blob) return;
    if (localOnly) {
      setRequestError(
        "내 문장은 서버 콘텐츠 ID가 없어 AI 분석을 요청할 수 없습니다.",
      );
      return;
    }
    setRequestError(null);
    setRequestFailure(null);
    setCanRetryAnalysis(false);
    setUploadProgress(0);
    try {
      const capabilities = await getAnalysisCapabilities();
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
      const activeSessionId = await ensureSession();
      setPhase("uploading");
      const uploadInput = {
        fileName: `recording-${Date.now()}.${prepared.extension}`,
        mimeType: prepared.mimeType,
        fileSizeBytes: prepared.blob.size,
      };
      const uploadInfo = await uploadRecordingWithFreshUrl({
        issueUploadUrl: () =>
          api.training.getUploadUrl(activeSessionId, uploadInput),
        upload: (currentUpload) =>
          api.training.uploadRecording(
            currentUpload,
            prepared.blob,
            setUploadProgress,
          ),
        onRetry: () => setUploadProgress(0),
      });
      const recording = await api.training.registerRecording(activeSessionId, {
        objectKey: uploadInfo.objectKey,
        mimeType: prepared.mimeType,
        fileSizeBytes: prepared.blob.size,
        durationMs: recorder.durationMs,
      });
      const recordingId = recording.recordingId ?? recording.id;
      if (recordingId == null) throw new Error("녹음 ID가 응답에 없습니다.");
      await waitForRecordingQuality(activeSessionId, recordingId);
      await api.training.selectRecording(activeSessionId, recordingId);
      selectedRecordingRef.current = recordingId;
      setRecordingAttempts((current) =>
        current.map((item) => ({
          ...item,
          selected: String(item.recordingId ?? item.id) === String(recordingId),
        })),
      );
      analysisPendingRef.current = true;
      setCanCheckAnalysis(true);
      const requested = await api.training.analyze(
        activeSessionId,
        await getConsentInput(),
      );
      setPhase("analyzing");
      const completedAnalysisId = await waitForAnalysis(
        activeSessionId,
        requested.analysisId,
      );
      await loadResult(
        activeSessionId,
        completedAnalysisId ?? requested.analysisId,
      );
    } catch (reason) {
      setRequestFailure(reason);
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "음성 분석 요청에 실패했습니다.",
      );
      setPhase("error");
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
      const completedAnalysisId = await waitForAnalysis(
        sessionId,
        requested.analysisId,
      );
      await loadResult(sessionId, completedAnalysisId ?? requested.analysisId);
    } catch (reason) {
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

  if (phase === "error") {
    const errorView = describePracticeError(requestFailure, recorder.status);
    const quality = errorView.kind === "quality";
    const canonicalFailure =
      requestFailure instanceof CanonicalResultUnavailable
        ? requestFailure.view
        : null;
    const rerecord = canonicalFailure
      ? canonicalFailure.actions.canRerecord
      : quality || errorView.kind === "input" || errorView.kind === "recording";
    return (
      <div className="flex min-h-full flex-col px-5 pb-8">
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
          {canCheckAnalysis && sessionId
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
            {courseDetail
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
              <b className="text-xl">{courseDetail?.stepCount ?? "—"}개</b>
              <p className="mt-2 text-[11px] text-muted-foreground">
                완료 단계
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
      {(phase === "idle" || phase === "recording") && (
        <>
          <div className="flex shrink-0 items-center px-5 pt-3 pb-4">
            <span className="rounded-full bg-[#edf2ff] px-2.5 py-[5px] text-[12px] leading-4 font-medium text-[#1f55e0]">
              {contentTypeLabel}
            </span>
            <span className="ml-auto text-[13px] leading-[18px] text-[#8b95a1]">
              {phase === "recording" ? (
                <>
                  <strong className="font-bold text-[#2f6bff]">
                    {activeSentence + 1}
                  </strong>
                  /{sentences.length} 문장
                </>
              ) : (
                <>
                  {sentences.length}문장
                  <span className="mx-2 inline-block h-2.5 w-px bg-[#dfe3e8]" />
                  약 {Math.max(1, Math.ceil(content.estimatedSeconds / 60))}분
                </>
              )}
            </span>
          </div>
          <SentenceReader
            sentences={sentences}
            activeIndex={phase === "recording" ? activeSentence : undefined}
            className="mx-5 max-h-[clamp(80px,calc(100dvh-440px),360px)] shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
          />
        </>
      )}

      {phase !== "result" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {phase === "idle" && (
            <div className="mt-auto flex flex-col items-center gap-4 px-5 pb-16">
              <div className="flex items-start gap-9">
                {recorder.status === "requesting" ? (
                  <span className="h-[84px] w-14" aria-hidden="true" />
                ) : (
                  <ReferencePlayer
                    contentId={content.id}
                    variant="guide"
                    disabled={!content.referenceAudioAvailable}
                  />
                )}
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  disabled={recorder.status === "requesting"}
                  className="flex size-[76px] items-center justify-center rounded-full bg-[#2f6bff] disabled:opacity-45"
                  aria-label="녹음 시작"
                >
                  <Image
                    src="/figma/practice/mic.svg"
                    alt=""
                    width={32}
                    height={32}
                  />
                </button>
                <span className="h-[84px] w-14" aria-hidden="true" />
              </div>
              <p className="text-center text-[14px] leading-5 font-medium text-[#8b95a1]">
                한 문장을 다 읽으면 가운데 문장 녹음 완료 버튼을 눌러 주세요
              </p>
            </div>
          )}

          {phase === "recording" && (
            <div className="mt-auto flex flex-col items-center gap-4 px-5 pb-16">
              <div
                className="flex h-12 items-center justify-center gap-1"
                aria-hidden="true"
              >
                {[
                  10, 18, 30, 22, 42, 27, 13, 33, 48, 28, 17, 38, 23, 43, 20,
                  32, 12, 27, 18, 10,
                ].map((height, index) => (
                  <span
                    key={index}
                    className="w-1 animate-pulse rounded-sm bg-[#2f6bff]"
                    style={{ height, animationDelay: `${index * 35}ms` }}
                  />
                ))}
              </div>
              <p className="flex items-center gap-2 text-[15px] leading-[22px] font-bold text-[#191f28]">
                <Image
                  src="/figma/practice/rec-dot.svg"
                  alt=""
                  width={8}
                  height={8}
                />
                <span>
                  {recorder.status === "stopping"
                    ? "녹음 마무리 중"
                    : "녹음 중"}
                </span>
                {formatElapsed(recorder.elapsedMs)}
              </p>
              <div className="flex items-start gap-9">
                <span className="h-[84px] w-14" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => {
                    if (recorder.status !== "recording") return;
                    if (activeSentence < sentences.length - 1) {
                      sentenceBoundaries.current[activeSentence + 1] =
                        recorder.getElapsedMs() / 1_000;
                      setActiveSentence((current) => current + 1);
                    } else {
                      recorder.stop();
                    }
                  }}
                  disabled={recorder.status !== "recording"}
                  className="flex size-[76px] items-center justify-center rounded-full bg-[#2f6bff] disabled:opacity-55"
                  aria-label={
                    activeSentence < sentences.length - 1
                      ? "문장 녹음 완료"
                      : "전체 녹음 완료"
                  }
                >
                  <span className="size-6 rounded-md bg-white" />
                </button>
                <span className="h-[84px] w-14" aria-hidden="true" />
              </div>
              <p className="text-[14px] leading-5 font-medium text-[#8b95a1]">
                {activeSentence < sentences.length - 1
                  ? "문장 녹음을 완료하면 다음 문장으로 자동으로 넘어가요"
                  : "다 읽으면 가운데 정지 버튼으로 녹음을 완료해 주세요"}
              </p>
            </div>
          )}

          {phase === "review" && recorder.previewUrl && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-6">
                <h2 className="text-[20px] leading-7 font-bold text-[#191f28]">
                  녹음을 확인해 주세요
                </h2>
                <p className="mt-2 text-[14px] leading-5 font-medium text-[#6b7584]">
                  문장마다 들어보고 분석을 요청해 주세요
                </p>
                <div className="mt-5 rounded-[20px] bg-white px-2 pt-2 pb-1.5 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
                  {sentences.map((sentence, index) => (
                    <div
                      key={`${index}-${sentence}`}
                      className="flex items-center gap-2 rounded-xl py-3 pr-2 pl-3"
                    >
                      <p className="min-w-0 flex-1 [overflow-wrap:anywhere] text-[15px] leading-[22px] font-medium text-[#333d4b]">
                        {sentence}
                      </p>
                      <div className="w-28 shrink-0">
                        <ReferencePlayer
                          source={recorder.previewUrl ?? undefined}
                          title={`${index + 1}문장 듣기`}
                          startSeconds={sentenceBoundaries.current[index] ?? 0}
                          endSeconds={
                            sentenceBoundaries.current[index + 1] ??
                            recorder.durationMs / 1_000
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
                  source={recorder.previewUrl}
                  title="전체 듣기"
                  durationSeconds={recorder.durationMs / 1_000}
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
            <div className="flex min-h-0 flex-1 flex-col items-center">
              <div className="flex-1" />
              <div className="size-[169px] shrink-0">
                <Image
                  src="/newsBird.webp"
                  alt=""
                  width={169}
                  height={169}
                  className="size-full object-contain"
                />
              </div>
              <p className="mt-5 min-h-14 w-full shrink-0 px-5 text-center text-[20px] leading-7 font-bold text-[#191f28]">
                {phase === "uploading" ? (
                  "음성을 보내고 있어요"
                ) : connectionRecovering ? (
                  "연결 복구 중이에요. 기존 분석 상태를 다시 확인하고 있어요."
                ) : (
                  <AnalysisLoadingMessage />
                )}
              </p>
              <div className="mt-9 w-[225px] rounded-[18px] bg-white px-3 py-2 shadow-[0_3px_5px_rgba(23,23,23,0.05)]">
                {["음성 품질 확인", "텍스트로 변환", "발음과 억양 분석"].map(
                  (label, index) => {
                    const threshold = index * 33;
                    const complete = stepProgress >= threshold + 33;
                    const current =
                      stepProgress >= threshold &&
                      stepProgress < threshold + 33;
                    return (
                      <div key={label} className="flex h-14 items-center gap-3">
                        <span className="relative flex h-14 w-7 shrink-0 items-center justify-center">
                          {index > 0 && (
                            <span
                              className={`absolute top-0 left-[13px] h-5 w-0.5 ${complete || current ? "bg-[#2f6bff]" : "bg-[#e5e8eb]"}`}
                            />
                          )}
                          {index < 2 && (
                            <span
                              className={`absolute bottom-0 left-[13px] h-5 w-0.5 ${complete ? "bg-[#2f6bff]" : "bg-[#e5e8eb]"}`}
                            />
                          )}
                          {complete ? (
                            <span className="z-10 flex size-7 items-center justify-center rounded-full bg-[#2f6bff]">
                              <Image
                                src="/figma/practice/check.svg"
                                alt=""
                                width={16}
                                height={16}
                              />
                            </span>
                          ) : (
                            <Image
                              src={
                                current
                                  ? "/figma/practice/dot-active.svg"
                                  : "/figma/practice/dot-inactive.svg"
                              }
                              alt=""
                              width={28}
                              height={28}
                              className="z-10"
                            />
                          )}
                        </span>
                        <span
                          className={`text-[15px] leading-[22px] ${current ? "font-bold text-[#143498]" : complete ? "font-medium text-[#4e5968]" : "text-[#b0b8c1]"}`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
              <div className="flex-1" />
            </div>
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
          {titleExamResult && (
            <section
              className={`design-card border ${titleExamResult.passed ? "border-[#84dfb7] bg-[#effcf6]" : "border-[#ffc4b8] bg-[#fff5f2]"}`}
              aria-label="승급 시험 결과"
            >
              <p className="text-xs font-semibold text-[#6b7684]">
                승급 시험 {titleExamResult.score}점 · 합격 기준{" "}
                {titleExamResult.passingScore}점
              </p>
              <h2 className="mt-2 text-xl font-bold">
                {titleExamResult.passed
                  ? `${titleExamResult.currentTitle} 칭호로 승급했어요!`
                  : "아쉽게도 이번에는 불합격이에요"}
              </h2>
              <p className="mt-2 text-sm text-[#6b7684]">
                {titleExamResult.passed
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
          {titleExamError && (
            <div
              role="alert"
              className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive"
            >
              {titleExamError}
              <button
                type="button"
                disabled={titleExamSubmitting}
                onClick={() => {
                  if (titleExamAnalysisId.current != null)
                    void submitTitleExamResult(titleExamAnalysisId.current);
                }}
                className="mt-3 block min-h-11 w-full rounded-xl border border-current font-semibold disabled:opacity-50"
              >
                {titleExamSubmitting ? "채점 확인 중…" : "채점 다시 확인"}
              </button>
            </div>
          )}
          <AnalysisView
            analysis={analysis}
            courseMode={Boolean(courseId)}
            segments={segments}
            content={content}
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
            <button
              type="button"
              disabled={loadingNext}
              onClick={() =>
                courseId
                  ? void goToNextContent()
                  : router.push(titleExamId ? "/mypage" : "/home")
              }
              className="h-14 w-full rounded-full bg-primary text-[16px] leading-6 font-bold text-white disabled:opacity-50"
            >
              {loadingNext
                ? "이동 중…"
                : courseId
                  ? courseFinished
                    ? "클래스 완료"
                    : "다음 단계"
                  : "완료하기"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
