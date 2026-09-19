"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Check,
  TrendingUp,
  RotateCcw,
  Square,
  Trash2,
  UploadCloud,
  CircleAlert,
} from "lucide-react";
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
  type PracticeContentRecommendation,
  type VoiceRecording,
  type CourseDetail,
  type UserTitleExamResult,
} from "@/lib/api";
import { ReferencePlayer } from "@/components/reference-player";
import { AnalysisView } from "@/components/analysis-view";
import { courseResultProgress } from "@/lib/course-result-progress";
import { AnalysisFailed, pollAnalysis } from "@/lib/analysis-polling";
import {
  describePracticeError,
  PracticeInputError,
} from "@/lib/practice-error";
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

export function PracticeSession({
  content,
  onTitleChange,
  localOnly = false,
}: {
  content: PracticeContent;
  localOnly?: boolean;
  onTitleChange?: (title: string) => void;
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
  const [requestFailure, setRequestFailure] = useState<unknown>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [titleExamResult, setTitleExamResult] =
    useState<UserTitleExamResult | null>(null);
  const [titleExamError, setTitleExamError] = useState<string | null>(null);
  const [canRetryAnalysis, setCanRetryAnalysis] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [recommendations, setRecommendations] = useState<
    PracticeContentRecommendation[]
  >([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null,
  );
  const [recordingAttempts, setRecordingAttempts] = useState<VoiceRecording[]>(
    [],
  );
  const [deletingRecordingId, setDeletingRecordingId] = useState<string | null>(
    null,
  );
  const [canCheckAnalysis, setCanCheckAnalysis] = useState(false);
  const analysisPendingRef = useRef(resumeType === "ANALYSIS_STATUS");
  const sessionIdRef = useRef<Id | null>(resumedSessionId);
  const phaseRef = useRef<Phase>("idle");
  const completedRef = useRef(resumeType === "ANALYSIS_RESULT");
  const capabilitiesRef = useRef<AnalysisCapabilities | null>(null);
  const recorder = useAudioRecorder();

  const courseId = searchParams.get("courseId");
  const courseStepId = searchParams.get("courseStepId");
  const analysisLearningFocus =
    content.learningFocus === "BOTH" ? "PRONUNCIATION" : content.learningFocus;
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
          : "분석 결과"
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
        !analysisPendingRef.current &&
        phaseRef.current !== "analyzing"
      ) {
        void api.training.cancel(activeSessionId).catch(() => undefined);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !resumedSessionId ||
      !["ANALYSIS_STATUS", "ANALYSIS_RESULT"].includes(resumeType ?? "")
    )
      return;

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
        if (active) setRecordingAttempts(attempts);

        let analysisId: Id;
        if (resumeType === "ANALYSIS_RESULT") {
          analysisId = (await api.training.getSessionAnalysis(resumedSessionId))
            .analysisId;
        } else {
          analysisId = await pollAnalysis({
            getStatus: () => {
              if (!active) throw new Error("Analysis polling stopped");
              return api.training.getAnalysisStatus(resumedSessionId);
            },
            onProgress: (progress) => {
              if (active) setAnalysisProgress(progress);
            },
          });
        }

        if (!active) return;
        const [result, segmentPage] = await Promise.all([
          api.analyses.get(analysisId),
          api.analyses.getSegments(analysisId, { page: 0, size: 100 }),
        ]);
        if (!active) return;
        setAnalysis(result);
        setSegments(segmentPage.items);
        if (resumeType === "ANALYSIS_STATUS") {
          await api.training.complete(resumedSessionId, 1);
          completedRef.current = true;
        }
        if (active) setPhase("result");
      } catch (reason) {
        if (!active) return;
        setRequestFailure(reason);
        setCanRetryAnalysis(reason instanceof AnalysisFailed);
        setCanCheckAnalysis(!(reason instanceof AnalysisFailed));
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
  }, [content.id, resumeType, resumedSessionId]);

  useEffect(() => {
    if (phase !== "result" || localOnly) return;
    let active = true;
    setRecommendationsLoading(true);
    setRecommendationError(null);
    setRecommendations([]);
    void api.content
      .getRecommendations(content.id)
      .then((items) => {
        if (active) setRecommendations(items);
      })
      .catch((reason) => {
        if (!active) return;
        setRecommendationError(
          reason instanceof Error
            ? reason.message
            : "비슷한 콘텐츠를 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (active) setRecommendationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [content.id, phase, localOnly]);

  async function ensureSession() {
    if (sessionId) return sessionId;
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
    if (capabilitiesRef.current) return capabilitiesRef.current;
    const capabilities = await api.training.getAnalysisCapabilities();
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

  async function waitForAnalysis(activeSessionId: Id) {
    analysisPendingRef.current = true;
    setCanCheckAnalysis(false);
    try {
      return await pollAnalysis({
        getStatus: () => api.training.getAnalysisStatus(activeSessionId),
        onProgress: setAnalysisProgress,
      });
    } catch (reason) {
      setRequestFailure(reason);
      setCanRetryAnalysis(reason instanceof AnalysisFailed);
      setCanCheckAnalysis(!(reason instanceof AnalysisFailed));
      throw reason;
    }
  }

  async function checkExistingAnalysis() {
    if (!sessionId) return;
    setRequestError(null);
    setRequestFailure(null);
    setCanCheckAnalysis(false);
    setPhase("analyzing");
    try {
      const analysisId = await waitForAnalysis(sessionId);
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
    if (titleExamId) {
      try {
        setTitleExamResult(
          await api.users.submitTitleExam(titleExamId, analysisId),
        );
      } catch (reason) {
        setTitleExamError(
          reason instanceof Error
            ? reason.message
            : "승급 시험 결과를 저장하지 못했습니다.",
        );
      }
    }
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
      const uploadInfo = await api.training.getUploadUrl(activeSessionId, {
        fileName: `recording-${Date.now()}.${prepared.extension}`,
        mimeType: prepared.mimeType,
        fileSizeBytes: prepared.blob.size,
      });
      await api.training.uploadRecording(
        uploadInfo,
        prepared.blob,
        setUploadProgress,
      );
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
      setRecordingAttempts((current) =>
        current.map((item) => ({
          ...item,
          selected: String(item.recordingId ?? item.id) === String(recordingId),
        })),
      );
      const requested = await api.training.analyze(
        activeSessionId,
        await getConsentInput(),
      );
      setPhase("analyzing");
      const completedAnalysisId = await waitForAnalysis(activeSessionId);
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
    setRequestError(null);
    setRequestFailure(null);
    setCanRetryAnalysis(false);
    setAnalysisProgress(0);
    setPhase("analyzing");
    try {
      const requested = await api.training.retryAnalysis(
        sessionId,
        await getConsentInput(),
      );
      const completedAnalysisId = await waitForAnalysis(sessionId);
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

  async function regenerateFeedback() {
    if (!analysis) return;
    if (localOnly) {
      setRequestError(
        "내 문장은 서버 분석 결과가 없어 코칭을 다시 불러올 수 없습니다.",
      );
      return;
    }
    setRegenerating(true);
    setRequestError(null);
    setRequestFailure(null);
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
      setRequestFailure(reason);
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "코칭을 다시 불러오지 못했습니다.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function deleteRecordingAttempt(recording: VoiceRecording) {
    if (!sessionId) return;
    const recordingId = recording.recordingId ?? recording.id;
    if (recordingId == null) return;
    if (!window.confirm(`${recording.attemptNo}번째 녹음을 삭제할까요?`))
      return;

    const key = String(recordingId);
    setDeletingRecordingId(key);
    setRequestError(null);
    setRequestFailure(null);
    try {
      await api.training.deleteRecording(sessionId, recordingId);
      setRecordingAttempts((current) =>
        current.filter(
          (item) => String(item.recordingId ?? item.id) !== String(recordingId),
        ),
      );
    } catch (reason) {
      setRequestFailure(reason);
      setRequestError(
        reason instanceof Error
          ? reason.message
          : "녹음 시도를 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingRecordingId(null);
    }
  }

  function goToRecommendation(item: PracticeContentRecommendation) {
    const returnTo = searchParams.get("returnTo") ?? "/home";
    router.push(
      `/practice/${item.id}?returnTo=${encodeURIComponent(returnTo)}`,
    );
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
        `/practice/${next.id}?returnTo=${encodeURIComponent(returnTo)}`,
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
    const rerecord =
      quality || errorView.kind === "input" || errorView.kind === "recording";
    return (
      <div className="flex min-h-[calc(100dvh-92px)] flex-col px-5 pb-8">
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
          onClick={() => {
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
            recorder.reset();
            setRequestError(null);
            setRequestFailure(null);
            setPhase("idle");
          }}
        >
          {canCheckAnalysis && sessionId
            ? "분석 상태 다시 확인"
            : canRetryAnalysis
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
      <div className="flex min-h-[calc(100dvh-80px)] flex-col px-5 text-center">
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
                  : `${Math.round(analysis.overallScore)}점`}
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

  return (
    <div className="flex min-h-[calc(100dvh-80px)] flex-col gap-5 px-5 pb-6">
      {localOnly && (
        <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs leading-5 text-primary">
          내 문장 체험 · 녹음은 이 기기에서만 재생됩니다. AI 분석은 서버에
          등록된 연습 콘텐츠에서 이용할 수 있습니다.
        </p>
      )}
      {!["result", "uploading", "analyzing"].includes(phase) && (
        <>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="rounded-md bg-primary/5 px-2 py-1 text-primary">
              {content.contentType === "NEWS"
                ? "뉴스 읽기"
                : content.contentType === "ANNOUNCER"
                  ? "아나운서 따라 읽기"
                  : courseId
                    ? "클래스"
                    : "문장 연습"}
            </span>
            <span>
              약 {Math.max(1, Math.ceil(content.estimatedSeconds / 60))}분
            </span>
          </div>
          <section className="design-card">
            <p className="text-[18px] leading-[1.7] font-medium">
              {content.scriptText}
            </p>
          </section>
        </>
      )}

      {phase !== "result" ? (
        <div className="mt-auto flex flex-1 flex-col items-center justify-end gap-5 py-6">
          {(phase === "idle" || phase === "recording") && (
            <button
              onClick={() =>
                phase === "recording" ? recorder.stop() : void startRecording()
              }
              disabled={recorder.status === "requesting"}
              className={cn(
                "flex size-20 items-center justify-center rounded-full transition-all",
                phase === "idle" && "bg-primary text-white hover:scale-105",
                phase === "recording" &&
                  "animate-pulse bg-primary text-white ring-[14px] ring-primary/10",
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
              <ReferencePlayer
                source={recorder.previewUrl}
                title="내 녹음 듣기"
                durationSeconds={recorder.durationMs / 1_000}
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    recorder.reset();
                    setRequestError(null);
                    setRequestFailure(null);
                    setPhase("idle");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border py-3 text-xs font-semibold"
                >
                  <RotateCcw className="size-4" />
                  다시 녹음
                </button>
                <button
                  onClick={() => void analyze()}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-xs font-semibold text-white"
                >
                  <UploadCloud className="size-4" />
                  분석 요청
                </button>
              </div>
              {!localOnly && (
                <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
                  분석 요청 시 녹음이 AI 발음 분석을 위해 서버로 전송됩니다.
                </p>
              )}
            </div>
          )}

          {phase === "review" &&
            recordingAttempts.some((recording) => !recording.selected) && (
              <section className="w-full rounded-3xl bg-surface p-5">
                <h2 className="text-sm font-semibold">
                  서버에 저장된 녹음 시도
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  분석하지 않을 녹음은 여기서 삭제할 수 있습니다.
                </p>
                <div className="mt-3 space-y-2">
                  {recordingAttempts
                    .filter((recording) => !recording.selected)
                    .map((recording) => {
                      const recordingId = recording.recordingId ?? recording.id;
                      const key = String(recordingId ?? recording.attemptNo);
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-2xl bg-background px-4 py-3"
                        >
                          <span className="text-xs">
                            {recording.attemptNo}번째 시도 ·{" "}
                            {recording.qualityStatus}
                          </span>
                          <button
                            type="button"
                            disabled={
                              recordingId == null || deletingRecordingId === key
                            }
                            onClick={() =>
                              void deleteRecordingAttempt(recording)
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-destructive disabled:opacity-40"
                          >
                            <Trash2 className="size-3.5" />
                            {deletingRecordingId === key ? "삭제 중…" : "삭제"}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

          {(phase === "uploading" || phase === "analyzing") && (
            <div className="my-auto w-full p-5 text-center">
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/5 text-primary">
                {phase === "uploading" ? (
                  <UploadCloud className="size-7" />
                ) : (
                  <TrendingUp className="size-7" />
                )}
              </div>
              <p className="text-xl font-bold">
                {phase === "uploading"
                  ? "음성을 보내고 있어요"
                  : "발음을 분석하고 있어요"}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                잠시만 기다려 주세요
              </p>
              {phase === "analyzing" && (
                <ol className="mx-auto mt-10 max-w-56 space-y-6 text-left">
                  {["분석 요청 접수", "발음 근거 분석", "결과 정리"].map(
                    (label, index) => (
                      <li
                        key={label}
                        className={`flex items-center gap-3 text-sm ${analysisProgress >= (index + 1) * 33 ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <span className="flex size-7 items-center justify-center rounded-full border">
                          {analysisProgress >= (index + 1) * 33 ? (
                            <Check className="size-4" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        {label}
                      </li>
                    ),
                  )}
                </ol>
              )}
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
                  : "학습 횟수는 유지되며 언제든 다시 응시할 수 있어요."}
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
            <p
              role="alert"
              className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive"
            >
              {titleExamError}
            </p>
          )}
          <AnalysisView
            analysis={analysis}
            courseMode={Boolean(courseId)}
            segments={segments}
            content={content}
            recordingUrl={recorder.previewUrl ?? resultAudioUrl}
          />
          {!courseId && analysis.outcome === "COACHING_READY" && (
            <details className="design-card">
              <summary className="cursor-pointer text-sm font-semibold">
                AI 코칭
              </summary>
              <div className="mt-4 space-y-3 text-sm">
                {analysis.strengths.map((item) => (
                  <p key={item}>{item}</p>
                ))}
                {analysis.weaknesses.map((item) => (
                  <p key={item}>{item}</p>
                ))}
                <p>
                  {analysis.summaryFeedback ?? "제공된 코칭 문구가 없습니다."}
                </p>
                <button
                  type="button"
                  disabled={regenerating}
                  onClick={() => void regenerateFeedback()}
                  className="text-primary"
                >
                  {regenerating ? "코칭 불러오는 중…" : "피드백 다시 불러오기"}
                </button>
              </div>
            </details>
          )}
          {requestError && (
            <p
              role="alert"
              className="rounded-2xl bg-destructive/10 px-4 py-3 text-center text-xs text-destructive"
            >
              {requestError}
            </p>
          )}
          {!courseId && (
            <section className="rounded-3xl bg-surface p-5">
              <h2 className="text-sm font-semibold">비슷한 콘텐츠</h2>
              {recommendationsLoading ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  추천 콘텐츠를 불러오는 중…
                </p>
              ) : recommendations.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {recommendations.map((item) => (
                    <button
                      key={String(item.id)}
                      type="button"
                      onClick={() => goToRecommendation(item)}
                      className="block w-full rounded-2xl bg-background p-4 text-left"
                    >
                      <span className="text-sm font-semibold">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.similarityReason}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  {recommendationError ?? "추천할 비슷한 콘텐츠가 없습니다."}
                </p>
              )}
            </section>
          )}
          <div className="sticky bottom-0 -mx-5 grid grid-cols-2 gap-2 border-t border-border bg-white p-5">
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
              onClick={() =>
                courseId ? void goToNextContent() : router.push("/home")
              }
              className="rounded-full bg-primary py-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loadingNext
                ? "이동 중…"
                : courseId
                  ? courseFinished
                    ? "클래스 완료"
                    : "다음 단계"
                  : "연습 마치기"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
