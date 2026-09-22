"use client";

import { useEffect, useRef, useState } from "react";
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
import { ReferencePlayer } from "@/components/reference-player";
import { AnalysisView } from "@/components/analysis-view";
import { courseResultProgress } from "@/lib/course-result-progress";
import { AnalysisFailed, pollAnalysis } from "@/lib/analysis-polling";
import {
  describePracticeError,
  PracticeInputError,
} from "@/lib/practice-error";
import { splitSentences } from "@/lib/sentences";

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
  const [requestFailure, setRequestFailure] = useState<unknown>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [titleExamResult, setTitleExamResult] =
    useState<UserTitleExamResult | null>(null);
  const [titleExamError, setTitleExamError] = useState<string | null>(null);
  const [canRetryAnalysis, setCanRetryAnalysis] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [recordingAttempts, setRecordingAttempts] = useState<VoiceRecording[]>(
    [],
  );
  const [canCheckAnalysis, setCanCheckAnalysis] = useState(false);
  const [activeSentence, setActiveSentence] = useState(0);
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
          const selectedRecording = attempts.find((item) => item.selected);
          const durationSeconds = Math.max(
            1,
            Math.round((selectedRecording?.durationMs ?? 0) / 1_000),
          );
          await api.training.complete(resumedSessionId, durationSeconds);
          completedRef.current = true;
          analysisPendingRef.current = false;
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
          <section className="mx-5 shrink-0 rounded-2xl bg-white p-2 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
            {sentences.map((sentence, index) => {
              const active = phase === "recording" && index === activeSentence;
              const pending = phase === "recording" && index > activeSentence;
              return (
                <div
                  key={`${index}-${sentence}`}
                  className={`flex items-stretch gap-2 rounded-xl px-3 py-2.5 ${active ? "bg-[#edf2ff]" : ""}`}
                >
                  {active && (
                    <span className="w-[3px] shrink-0 rounded-sm bg-[#2f6bff]" />
                  )}
                  <p
                    className={`flex-1 text-[16px] leading-6 ${active ? "font-bold text-[#191f28]" : `font-medium ${pending ? "text-[#b0b8c1]" : "text-[#191f28]"}`}`}
                  >
                    {sentence}
                  </p>
                </div>
              );
            })}
          </section>
        </>
      )}

      {phase !== "result" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {phase === "idle" && (
            <div className="mt-auto flex flex-col items-center gap-4 px-5 pb-16">
              <div className="flex items-start gap-9">
                <ReferencePlayer
                  contentId={content.id}
                  variant="guide"
                  disabled={!content.referenceAudioAvailable}
                />
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
                첫 문장부터 읽고 다음 문장 버튼으로 넘어가요
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
                {formatElapsed(recorder.elapsedMs)}
              </p>
              <div className="flex items-start gap-9">
                <ReferencePlayer
                  contentId={content.id}
                  variant="guide"
                  disabled
                />
                <button
                  type="button"
                  onClick={recorder.stop}
                  className="flex size-[76px] items-center justify-center rounded-full bg-[#2f6bff]"
                  aria-label="녹음 종료"
                >
                  <span className="size-6 rounded-md bg-white" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeSentence >= sentences.length - 1) recorder.stop();
                    else setActiveSentence((current) => current + 1);
                  }}
                  className="flex flex-col items-center gap-1.5 pt-2.5"
                >
                  <span className="flex size-14 items-center justify-center rounded-full bg-[#191f28]">
                    <Image
                      src="/figma/practice/arrow-right.svg"
                      alt=""
                      width={22}
                      height={22}
                    />
                  </span>
                  <span className="text-[12px] leading-4 font-bold text-[#4e5968]">
                    {activeSentence >= sentences.length - 1
                      ? "녹음 완료"
                      : "다음 문장"}
                  </span>
                </button>
              </div>
              <p className="text-[14px] leading-5 font-medium text-[#8b95a1]">
                다 읽으면 다음 문장으로 넘어가요
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
                      <p className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium text-[#333d4b]">
                        {sentence}
                      </p>
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8f4ff]"
                        title="문장별 구간 데이터 미제공"
                      >
                        <Image
                          src="/figma/practice/play-small.svg"
                          alt=""
                          width={14}
                          height={14}
                        />
                      </span>
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
            <div className="flex min-h-[650px] flex-1 flex-col items-center">
              <div className="flex-1" />
              <div className="h-[169px] w-[140px] overflow-hidden">
                <Image
                  src="/figma/practice/analysis-character.png"
                  alt=""
                  width={197}
                  height={197}
                  className="-ml-[29px] -mt-[14px] h-[197px] w-[197px] max-w-none"
                />
              </div>
              <p className="mt-5 text-[20px] leading-7 font-bold text-[#191f28]">
                {phase === "uploading"
                  ? "음성을 보내고 있어요"
                  : "발음을 분석하고 있어요"}
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
          {requestError && (
            <p
              role="alert"
              className="rounded-2xl bg-destructive/10 px-4 py-3 text-center text-xs text-destructive"
            >
              {requestError}
            </p>
          )}
          <div className="sticky bottom-0 -mx-5 border-t border-[#e5e8eb] bg-white px-5 py-3">
            <button
              type="button"
              disabled={loadingNext}
              onClick={() =>
                courseId ? void goToNextContent() : router.push("/home")
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
