"use client";

import {
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  RotateCcw,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnalysisView } from "@/components/analysis-view";
import { AnalysisLoadingMessage } from "@/components/analysis-loading-message";
import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { requireAnalysisScope } from "@/lib/api/analysis-capabilities";
import {
  awaitCanonicalPersistence,
  completeCanonicalPractice,
  invalidatesCanonicalResult,
  persistencePending,
} from "@/lib/canonical-persistence";
import { waitForCanonicalResult } from "@/lib/canonical-result-wait";
import {
  canonicalPresentation,
  CanonicalResultUnavailable,
} from "@/lib/canonical-presentation";
import {
  ApiError,
  getAuthSessionVersion,
  subscribeAuthSession,
} from "@/lib/api/client";
import {
  api,
  type AnalysisResult,
  type AnalysisSegment,
  type PracticeContent,
} from "@/lib/api";
import {
  LIP_PRACTICE_PROMPTS,
  prepareVideoForAnalysis,
  preferredVideoMimeType,
  releaseLipResources,
  type LipClip,
  type LipPracticeStep,
} from "@/lib/lip-practice";
import { uploadRecordingWithFreshUrl } from "@/lib/recording-upload";

const MAX_RECORDING_MS = 12_000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type LipAnalysisPhase =
  "idle" | "preparing" | "uploading" | "analyzing" | "result" | "error";

type LipAnalysisBundle = {
  sessionId: import("@/lib/api/types").Id;
  content: PracticeContent;
  analysis: AnalysisResult;
  segments: AnalysisSegment[];
};

export default function LipPractice() {
  const [step, setStep] = useState<LipPracticeStep>("guide");
  const [promptIndex, setPromptIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [clips, setClips] = useState<LipClip[]>([]);
  const [selectedClip, setSelectedClip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(true);
  const [videoConsentAccepted, setVideoConsentAccepted] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<LipAnalysisPhase>("idle");
  const [analysisTarget, setAnalysisTarget] = useState<number | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<
    Partial<Record<number, LipAnalysisBundle>>
  >({});
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const clipsRef = useRef<LipClip[]>([]);
  const recordingStartedAtRef = useRef(0);
  const contentByPromptRef = useRef(new Map<number, PracticeContent>());
  const mounted = useRef(false);
  const mediaRequest = useRef(0);
  const mediaBusy = useRef(false);
  const analysisBusyRef = useRef(false);
  const analysisOwnerRef = useRef<AbortController | null>(null);
  const analysisBusy =
    analysisPhase === "preparing" ||
    analysisPhase === "uploading" ||
    analysisPhase === "analyzing";

  useEffect(
    () =>
      subscribeAuthSession(() => {
        analysisOwnerRef.current?.abort();
        setAnalyses({});
        setAnalysisError(null);
        setAnalysisPhase("idle");
      }),
    [],
  );

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      analysisOwnerRef.current?.abort();
      mediaRequest.current += 1;
      mediaBusy.current = false;
      if (stopTimerRef.current !== null)
        window.clearTimeout(stopTimerRef.current);
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state === "recording") recorder.stop();
      }
      releaseLipResources(streamRef.current, clipsRef.current);
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!previewRef.current || !streamRef.current) return;
    previewRef.current.srcObject = streamRef.current;
    void previewRef.current.play().catch(() => undefined);
  }, [step]);

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (!mounted.current || recorderRef.current?.state === "recording") return;
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      setError("이 브라우저에서는 영상 녹화를 지원하지 않아요.");
      setStep("permission");
      return;
    }
    const mimeType = preferredVideoMimeType((value) =>
      MediaRecorder.isTypeSupported(value),
    );
    try {
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (!mounted.current) return;
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        if (!mounted.current) return;
        setError("녹화 중 문제가 발생했어요. 다시 촬영해 주세요.");
        setStep("align");
      };
      recorder.onstop = () => {
        if (!mounted.current) return;
        const durationMs = Math.max(
          1,
          Date.now() - recordingStartedAtRef.current,
        );
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || chunksRef.current[0]?.type || "video/mp4",
        });
        if (blob.size === 0) {
          setError("녹화된 영상이 없어요. 다시 촬영해 주세요.");
          setStep("align");
          return;
        }
        const url = URL.createObjectURL(blob);
        const current = clipsRef.current;
        const previous = current.find(
          (clip) => clip.promptIndex === promptIndex,
        );
        if (previous) URL.revokeObjectURL(previous.url);
        const nextClips = [
          ...current.filter((clip) => clip.promptIndex !== promptIndex),
          { promptIndex, blob, url, durationMs },
        ].sort((a, b) => a.promptIndex - b.promptIndex);
        clipsRef.current = nextClips;
        setClips(nextClips);
        setAnalyses((current) => {
          const next = { ...current };
          delete next[promptIndex];
          return next;
        });
        contentByPromptRef.current.delete(promptIndex);
        setSelectedClip(promptIndex);
        setAnalysisPhase("idle");
        setAnalysisError(null);
        setStep("review");
      };
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      // Safari/iOS의 MP4는 timeslice로 조각내면 첫 조각만 재생되는 파일이
      // 만들어질 수 있으므로 stop 시점에 완성된 파일 하나를 받는다.
      recorder.start();
      setStep("recording");
      stopTimerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      setError("이 기기에서 영상 녹화를 시작하지 못했어요.");
      setStep("align");
    }
  }, [promptIndex, stopRecording]);

  useEffect(() => {
    if (step !== "countdown") return;
    setCountdown(3);
    let remaining = 3;
    let startTimer: number | undefined;
    const interval = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining === 0) {
        window.clearInterval(interval);
        startTimer = window.setTimeout(startRecording, 240);
      }
    }, 800);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(startTimer);
    };
  }, [startRecording, step]);

  async function requestMedia() {
    if (mediaBusy.current || !mounted.current) return;
    mediaBusy.current = true;
    const request = ++mediaRequest.current;
    setStep("permission");
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      mediaBusy.current = false;
      setError("이 브라우저에서는 카메라와 마이크를 사용할 수 없어요.");
      return;
    }
    try {
      await requireAnalysisScope("VIDEO");
      if (!mounted.current || request !== mediaRequest.current) return;
      releaseLipResources(streamRef.current, []);
      streamRef.current = null;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!mounted.current || request !== mediaRequest.current) {
        releaseLipResources(stream, []);
        return;
      }
      streamRef.current = stream;
      setStep("align");
    } catch (reason) {
      if (!mounted.current || request !== mediaRequest.current) return;
      const denied =
        reason instanceof DOMException &&
        (reason.name === "NotAllowedError" || reason.name === "SecurityError");
      setError(
        denied
          ? "카메라와 마이크 권한이 필요해요. iPhone 설정의 SPEAK AI에서 권한을 허용해 주세요."
          : reason instanceof Error
            ? reason.message
            : "카메라와 마이크를 시작하지 못했어요.",
      );
    } finally {
      if (request === mediaRequest.current) mediaBusy.current = false;
    }
  }

  function beginPrompt(index = promptIndex) {
    setPromptIndex(index);
    setError(null);
    setStep("countdown");
  }

  function continueFlow() {
    if (promptIndex >= LIP_PRACTICE_PROMPTS.length - 1) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setSelectedClip(0);
      setAnalysisPhase(analyses[0] ? "result" : "idle");
      setStep("complete");
      return;
    }
    setPromptIndex((value) => value + 1);
    setStep("align");
  }

  const currentClip = clips.find((clip) => clip.promptIndex === promptIndex);
  const reportClip = clips.find((clip) => clip.promptIndex === selectedClip);
  const selectedAnalysis = analyses[selectedClip];

  async function analyzeSelectedClip() {
    if (!reportClip || analysisBusyRef.current || !mounted.current) return;
    if (!videoConsentAccepted) {
      setAnalysisError("영상·음성 AI 분석 및 처리에 먼저 동의해 주세요.");
      setAnalysisPhase("error");
      return;
    }

    analysisBusyRef.current = true;
    const owner = new AbortController();
    analysisOwnerRef.current?.abort();
    analysisOwnerRef.current = owner;
    const epoch = getAuthSessionVersion();
    let previewShown = false;
    setAnalysisPhase("preparing");
    setAnalysisTarget(selectedClip);
    setAnalysisError(null);
    setUploadProgress(0);
    setAnalysisProgress(0);
    const requireActive = () => {
      if (
        !mounted.current ||
        owner.signal.aborted ||
        epoch !== getAuthSessionVersion()
      )
        throw new DOMException("화면이 닫혔습니다.", "AbortError");
    };

    try {
      await requireAnalysisScope("VIDEO", owner.signal);
      const capabilities = await api.training.getAnalysisCapabilities();
      requireActive();
      if (
        capabilities.recordingUpload !== "CONFIGURED" ||
        capabilities.analysisRequests !== "CONFIGURED" ||
        !capabilities.supportedLearningFocuses.includes("PRONUNCIATION")
      ) {
        throw new Error("현재 서버의 영상 발음 분석 기능을 사용할 수 없어요.");
      }
      if (
        capabilities.videoProcessingConsentRequired &&
        !capabilities.videoProcessingConsentPolicyRevision
      ) {
        throw new Error("영상 처리 동의 정책 정보를 불러오지 못했어요.");
      }
      if (!capabilities.consentPolicyRevision) {
        throw new Error("음성 처리 동의 정책 정보를 불러오지 못했어요.");
      }
      if (reportClip.durationMs < capabilities.minimumDurationMs) {
        throw new Error(
          `분석하려면 ${Math.ceil(capabilities.minimumDurationMs / 1_000)}초 이상 촬영해 주세요.`,
        );
      }
      if (reportClip.durationMs > capabilities.maximumDurationMs) {
        throw new Error(
          `영상은 ${Math.floor(capabilities.maximumDurationMs / 1_000)}초 이내여야 해요.`,
        );
      }

      const prepared = prepareVideoForAnalysis(
        reportClip.blob,
        capabilities.acceptedVideoMimeTypes,
      );
      if (prepared.blob.size > capabilities.maximumVideoUploadBytes) {
        throw new Error("촬영 영상이 서버의 업로드 제한을 초과했어요.");
      }

      let content = contentByPromptRef.current.get(selectedClip);
      if (!content) {
        content = await api.content.createCustom(
          {
            title: `입모양 연습 ${selectedClip + 1}`,
            scriptText: LIP_PRACTICE_PROMPTS[selectedClip],
            learningFocus: "PRONUNCIATION",
            retention: "SESSION_HISTORY",
            locale: "ko-KR",
          },
          typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : undefined,
        );
        requireActive();
        contentByPromptRef.current.set(selectedClip, content);
      }

      const session = await api.training.create({
        contentId: content.id,
        learningFocus: "PRONUNCIATION",
      });
      requireActive();
      const sessionId = session.sessionId ?? session.id;
      if (sessionId == null) throw new Error("학습 세션을 만들지 못했어요.");

      setAnalysisPhase("uploading");
      const uploadInput = {
        fileName: `lip-practice-${Date.now()}.${prepared.extension}`,
        mimeType: prepared.mimeType,
        fileSizeBytes: prepared.blob.size,
      };
      const uploadInfo = await uploadRecordingWithFreshUrl({
        issueUploadUrl: () => {
          requireActive();
          return api.training.getUploadUrl(sessionId, uploadInput);
        },
        upload: (currentUpload) => {
          requireActive();
          return api.training.uploadRecording(
            currentUpload,
            prepared.blob,
            (progress) => {
              if (mounted.current) setUploadProgress(progress);
            },
          );
        },
        onRetry: () => {
          if (mounted.current) setUploadProgress(0);
        },
      });
      requireActive();
      const recording = await api.training.registerRecording(sessionId, {
        objectKey: uploadInfo.objectKey,
        mimeType: prepared.mimeType,
        fileSizeBytes: prepared.blob.size,
        durationMs: reportClip.durationMs,
        videoProcessingConsentAccepted: true,
        videoProcessingConsentPolicyRevision:
          capabilities.videoProcessingConsentPolicyRevision,
      });
      requireActive();
      const recordingId = recording.recordingId ?? recording.id;
      if (recordingId == null) throw new Error("영상 녹화 ID가 없습니다.");

      for (let attempt = 0; attempt < 30; attempt += 1) {
        requireActive();
        const recordings = await api.training.listRecordings(sessionId);
        requireActive();
        const current = recordings.find(
          (item) => String(item.recordingId ?? item.id) === String(recordingId),
        );
        if (current?.qualityStatus === "PASS") break;
        if (current && current.qualityStatus !== "PENDING") {
          throw new Error(
            `영상의 음성 품질을 확인해 주세요: ${current.qualityStatus}`,
          );
        }
        if (attempt === 29) {
          throw new Error(
            "영상 품질 확인이 지연되고 있어요. 다시 시도해 주세요.",
          );
        }
        await wait(1_000);
      }

      await api.training.selectRecording(sessionId, recordingId);
      requireActive();
      const requested = await api.training.analyze(sessionId, {
        accepted: true,
        policyRevision: capabilities.consentPolicyRevision,
      });
      requireActive();
      setAnalysisPhase("analyzing");
      let analysis = await waitForCanonicalResult({
        sessionId,
        recordingId,
        analysisId: requested.analysisId,
        signal: owner.signal,
        onProgress: setAnalysisProgress,
        onConnectionChange: () => undefined,
      });
      requireActive();
      const show = () => {
        setAnalyses((current) => ({
          ...current,
          [selectedClip]: {
            sessionId,
            content: content!,
            analysis,
            segments: [],
          },
        }));
        setAnalysisPhase("result");
        previewShown = true;
      };
      show();
      if (analysis.canonical && persistencePending(analysis.canonical)) {
        const current = await awaitCanonicalPersistence(
          analysis.canonical,
          owner.signal,
          () => {
            setAnalysisError("결과 저장 상태를 확인하고 있습니다.");
          },
        );
        requireActive();
        analysis = canonicalPresentation(current);
        show();
      }
      if (analysis.canonical?.actions.canComplete) {
        await completeCanonicalPractice(
          api,
          sessionId,
          analysis.canonical,
          () =>
            mounted.current &&
            !owner.signal.aborted &&
            epoch === getAuthSessionVersion(),
        );
        requireActive();
        setAnalysisError(null);
      } else if (analysis.canonical) {
        setAnalysisError(
          new CanonicalResultUnavailable(analysis.canonical).message,
        );
      }
    } catch (reason) {
      if (
        !mounted.current ||
        owner.signal.aborted ||
        epoch !== getAuthSessionVersion()
      )
        return;
      if (invalidatesCanonicalResult(reason)) {
        setAnalyses((current) => {
          const next = { ...current };
          delete next[selectedClip];
          return next;
        });
        previewShown = false;
      }
      setAnalysisError(
        reason instanceof Error
          ? reason.message
          : "영상 발음 분석을 완료하지 못했어요.",
      );
      setAnalysisPhase(previewShown ? "result" : "error");
    } finally {
      if (analysisOwnerRef.current === owner) analysisOwnerRef.current = null;
      analysisBusyRef.current = false;
    }
  }

  async function refreshSavedResult() {
    const bundle = analyses[selectedClip];
    const view = bundle?.analysis.canonical;
    if (!bundle || !view || analysisBusyRef.current) return;
    analysisBusyRef.current = true;
    const owner = new AbortController();
    analysisOwnerRef.current = owner;
    const epoch = getAuthSessionVersion();
    const active = () =>
      mounted.current &&
      !owner.signal.aborted &&
      epoch === getAuthSessionVersion();
    try {
      const current = await awaitCanonicalPersistence(
        view,
        owner.signal,
        () => {
          if (active())
            setAnalysisError("결과 저장 상태를 다시 확인하고 있습니다.");
        },
      );
      if (!active()) return;
      setAnalyses((previous) => ({
        ...previous,
        [selectedClip]: { ...bundle, analysis: canonicalPresentation(current) },
      }));
      if (current.actions.canComplete) {
        await completeCanonicalPractice(api, bundle.sessionId, current, active);
        if (active()) setAnalysisError(null);
      } else setAnalysisError(new CanonicalResultUnavailable(current).message);
    } catch (reason) {
      if (!active()) return;
      if (invalidatesCanonicalResult(reason)) {
        setAnalyses((previous) => {
          const next = { ...previous };
          delete next[selectedClip];
          return next;
        });
        setAnalysisPhase("error");
      }
      setAnalysisError(
        reason instanceof Error
          ? reason.message
          : "저장 상태를 확인하지 못했습니다.",
      );
    } finally {
      if (analysisOwnerRef.current === owner) analysisOwnerRef.current = null;
      analysisBusyRef.current = false;
    }
  }

  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#f2f4f6"
      bottomChromeColor="#ffffff"
    >
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f8fa]">
        <header className="relative z-20 flex h-16 shrink-0 items-center justify-between px-5">
          <BackButton
            fallback="/home"
            label="입모양 연습 닫기"
            className="flex size-11 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur"
          >
            <X className="size-5" />
          </BackButton>
          <p className="text-sm font-bold">
            {step === "guide" || step === "tips" || step === "setup"
              ? "입모양 연습"
              : step === "complete"
                ? "촬영 완료"
                : `${promptIndex + 1}/${LIP_PRACTICE_PROMPTS.length}`}
          </p>
          <span className="size-11" aria-hidden="true" />
        </header>

        {step === "guide" ? (
          <IntroStep
            icon={<Camera className="size-10" />}
            eyebrow="새로운 연습"
            title={
              <>
                내 입모양을 보며
                <br />
                또박또박 말해 봐요
              </>
            }
            description="5개의 짧은 문장을 촬영하고, 원하는 영상을 선택해 AI 발음 피드백을 받아요."
            action="연습 알아보기"
            onAction={() => setStep("tips")}
          />
        ) : step === "tips" ? (
          <InfoStep
            title="촬영 전에 확인해 주세요"
            items={[
              ["밝은 곳에서", "얼굴과 입이 잘 보이도록 앉아 주세요."],
              ["정면을 바라보고", "화면의 얼굴 가이드에 맞춰 주세요."],
              ["평소 목소리로", "문장을 끝까지 또박또박 읽어 주세요."],
            ]}
            action="촬영 설정하기"
            onAction={() => setStep("setup")}
          />
        ) : step === "setup" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-6">
            <h1 className="mt-5 text-[26px] leading-9 font-bold">
              촬영 화면을 설정해요
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              전면 카메라는 거울처럼 표시할 수 있어요.
            </p>
            <section className="design-card mt-8 shrink-0 !p-4">
              <label className="flex min-h-14 items-center justify-between gap-4">
                <span>
                  <strong className="block text-sm">화면 좌우 반전</strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    익숙한 거울 화면으로 촬영
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={mirrored}
                  onChange={(event) => setMirrored(event.target.checked)}
                  className="size-6 accent-[#2f6bff]"
                />
              </label>
              <label className="mt-3 flex min-h-14 items-start gap-3 border-t border-border pt-4">
                <input
                  type="checkbox"
                  checked={videoConsentAccepted}
                  onChange={(event) =>
                    setVideoConsentAccepted(event.target.checked)
                  }
                  className="mt-0.5 size-6 shrink-0 accent-[#2f6bff]"
                />
                <span>
                  <strong className="block text-sm">
                    영상·음성 AI 분석 및 처리 동의
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    선택한 영상과 음성을 서버로 전송해 발음 피드백을 생성합니다.
                  </span>
                </span>
              </label>
            </section>
            <PrivacyNote />
            <BottomAction
              label="카메라·마이크 권한 확인"
              onClick={() => void requestMedia()}
              disabled={!videoConsentAccepted}
            />
          </div>
        ) : step === "permission" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-6 text-center">
            <span className="mx-auto mt-auto flex size-24 shrink-0 items-center justify-center rounded-[32px] bg-[#eaf4ff] text-primary">
              <ShieldCheck className="size-11" />
            </span>
            <h1 className="mt-7 text-2xl font-bold">
              {error ? "권한을 확인해 주세요" : "권한을 확인하고 있어요"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              촬영을 위해 카메라와 마이크를 모두 허용해 주세요.
            </p>
            {error ? (
              <p
                role="alert"
                className="mt-5 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-600"
              >
                {error}
              </p>
            ) : (
              <span className="mx-auto mt-6 size-7 shrink-0 animate-spin rounded-full border-3 border-primary/20 border-t-primary" />
            )}
            <div className="mt-auto shrink-0 pt-5">
              {error ? (
                <button
                  type="button"
                  onClick={() => void requestMedia()}
                  className="design-action"
                >
                  권한 다시 확인
                </button>
              ) : null}
            </div>
          </div>
        ) : step === "complete" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
            <section className="pt-5 text-center">
              <span className="mx-auto flex size-20 items-center justify-center rounded-[28px] bg-[#eaf8f3] text-[#00a878]">
                <Check className="size-10" />
              </span>
              <h1 className="mt-5 text-2xl font-bold">
                5개 문장을 모두 촬영했어요
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                문장을 선택해 촬영 영상을 확인하고 AI 발음 분석을 시작하세요.
              </p>
            </section>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {LIP_PRACTICE_PROMPTS.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={analysisBusy}
                  onClick={() => {
                    setSelectedClip(index);
                    setAnalysisTarget(null);
                    setAnalysisError(null);
                    setAnalysisPhase(analyses[index] ? "result" : "idle");
                  }}
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${selectedClip === index ? "bg-primary text-white" : "bg-white text-muted-foreground"}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            {reportClip ? (
              <video
                key={reportClip.url}
                src={reportClip.url}
                controls
                playsInline
                className="mt-3 aspect-[3/4] w-full rounded-[24px] bg-black object-cover"
              />
            ) : null}
            <p className="mt-3 text-center text-sm font-bold">
              {LIP_PRACTICE_PROMPTS[selectedClip]}
            </p>

            {analysisTarget === selectedClip && analysisBusy ? (
              <section className="mt-4 rounded-[20px] bg-[#f4f9ff] p-5 text-center">
                <Image
                  src="/newsBird.webp"
                  alt=""
                  width={96}
                  height={96}
                  className="mx-auto size-24 object-contain"
                />
                <strong className="mt-3 block min-h-16 text-sm">
                  {analysisPhase === "preparing" ? (
                    <span role="status">영상을 분석할 준비를 하고 있어요</span>
                  ) : analysisPhase === "uploading" ? (
                    <span role="status">
                      영상을 보내고 있어요 {uploadProgress}%
                    </span>
                  ) : (
                    <>
                      <AnalysisLoadingMessage />
                      <span className="mt-1 block">{analysisProgress}%</span>
                    </>
                  )}
                </strong>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  화면을 닫지 말고 잠시 기다려 주세요.
                </p>
              </section>
            ) : analysisPhase === "error" && analysisError ? (
              <section
                role="alert"
                className="mt-4 rounded-[20px] bg-red-50 p-4"
              >
                <div className="flex gap-3">
                  <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-500" />
                  <div>
                    <strong className="text-sm text-red-700">
                      영상 발음 분석을 완료하지 못했어요
                    </strong>
                    <p className="mt-1 text-xs leading-5 text-red-600">
                      {analysisError}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void analyzeSelectedClip()}
                  className="mt-4 min-h-12 w-full rounded-full bg-primary text-sm font-bold text-white"
                >
                  다시 분석하기
                </button>
              </section>
            ) : selectedAnalysis ? (
              <div className="mt-5">
                {analysisError && (
                  <div role="status" className="mb-3 text-sm">
                    <p>{analysisError}</p>
                    <button
                      type="button"
                      className="mt-2 min-h-11 rounded-xl border px-4"
                      onClick={() => void refreshSavedResult()}
                    >
                      저장·완료 상태 다시 확인
                    </button>
                  </div>
                )}
                <AnalysisView
                  analysis={selectedAnalysis.analysis}
                  segments={selectedAnalysis.segments}
                  content={selectedAnalysis.content}
                  recordingUrl={reportClip?.url}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void analyzeSelectedClip()}
                disabled={!reportClip}
                className="design-action mt-4 disabled:cursor-not-allowed disabled:opacity-45"
              >
                AI 발음 분석하기
              </button>
            )}

            <button
              type="button"
              disabled={analysisBusy}
              onClick={() => {
                setPromptIndex(selectedClip);
                setAnalysisPhase("idle");
                setAnalysisTarget(null);
                setAnalysisError(null);
                void requestMedia();
              }}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-white text-sm font-bold disabled:opacity-45"
            >
              <RotateCcw className="size-4" />
              선택한 문장 다시 촬영
            </button>
            <BackButton
              fallback="/home"
              label="입모양 연습 완료"
              className="design-action mt-3"
            >
              완료
            </BackButton>
          </div>
        ) : (
          <CameraStage mirrored={mirrored} videoRef={previewRef}>
            {step === "align" ? (
              <div className="absolute inset-x-5 bottom-3 z-10 max-h-[calc(100%_-_24px)] overflow-y-auto overscroll-contain rounded-[24px] bg-white/94 p-5 text-center shadow-xl backdrop-blur">
                <p className="text-xs font-bold text-primary">
                  문장 {promptIndex + 1}
                </p>
                <h1 className="mt-2 text-lg leading-7 font-bold">
                  {LIP_PRACTICE_PROMPTS[promptIndex]}
                </h1>
                <p className="mt-2 text-xs text-muted-foreground">
                  얼굴을 가이드 안에 맞춰 주세요.
                </p>
                <button
                  type="button"
                  onClick={() => beginPrompt()}
                  className="design-action mt-4"
                >
                  촬영 시작
                </button>
              </div>
            ) : null}
            {step === "countdown" ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                <span className="flex size-28 items-center justify-center rounded-full bg-white/92 text-5xl font-extrabold text-primary shadow-2xl">
                  {countdown || "·"}
                </span>
              </div>
            ) : null}
            {step === "recording" ? (
              <div className="absolute inset-x-5 bottom-3 z-10 max-h-[calc(100%_-_24px)] overflow-y-auto overscroll-contain rounded-[24px] bg-black/70 p-5 text-center text-white backdrop-blur">
                <span className="inline-flex items-center gap-2 text-xs font-bold">
                  <span className="size-2 animate-pulse rounded-full bg-red-500" />
                  촬영 중
                </span>
                <p className="mt-3 text-lg leading-7 font-bold">
                  {LIP_PRACTICE_PROMPTS[promptIndex]}
                </p>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="mx-auto mt-5 flex size-14 items-center justify-center rounded-full bg-white text-red-500"
                  aria-label="촬영 종료"
                >
                  <Square className="size-6 fill-current" />
                </button>
              </div>
            ) : null}
            {step === "review" && currentClip ? (
              <div className="absolute inset-0 z-20 flex flex-col bg-[#f7f8fa] px-5 pb-6">
                <video
                  src={currentClip.url}
                  controls
                  autoPlay
                  playsInline
                  className="mt-3 min-h-0 flex-1 rounded-[24px] bg-black object-contain"
                />
                <p className="mt-4 text-center text-sm font-bold">
                  문장 {promptIndex + 1} 촬영을 확인해 주세요
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("align")}
                    className="flex min-h-14 items-center justify-center gap-2 rounded-full border border-border bg-white text-sm font-bold"
                  >
                    <RotateCcw className="size-4" />
                    다시 촬영
                  </button>
                  <button
                    type="button"
                    onClick={continueFlow}
                    className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-white"
                  >
                    {promptIndex === LIP_PRACTICE_PROMPTS.length - 1
                      ? "촬영 완료"
                      : "다음 문장"}
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </CameraStage>
        )}
      </div>
    </AppShell>
  );
}

function CameraStage({
  children,
  mirrored,
  videoRef,
}: {
  children: ReactNode;
  mirrored: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#101316]">
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
      />
      <div className="pointer-events-none absolute top-[10%] left-1/2 h-[46%] w-[70%] -translate-x-1/2 rounded-[46%] border-2 border-dashed border-white/75" />
      {children}
    </div>
  );
}

function IntroStep({
  icon,
  eyebrow,
  title,
  description,
  action,
  onAction,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: ReactNode;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-6">
      <span className="mt-14 flex size-20 shrink-0 items-center justify-center rounded-[28px] bg-[#eaf4ff] text-primary">
        {icon}
      </span>
      <p className="mt-7 text-sm font-bold text-primary">{eyebrow}</p>
      <h1 className="mt-2 text-[28px] leading-10 font-bold">{title}</h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <PrivacyNote />
      <BottomAction label={action} onClick={onAction} />
    </div>
  );
}

function InfoStep({
  title,
  items,
  action,
  onAction,
}: {
  title: string;
  items: ReadonlyArray<readonly [string, string]>;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-6">
      <h1 className="mt-6 text-[26px] leading-9 font-bold">{title}</h1>
      <ol className="mt-7 space-y-3">
        {items.map(([heading, body], index) => (
          <li key={heading} className="design-card flex gap-4 !p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eaf4ff] text-sm font-bold text-primary">
              {index + 1}
            </span>
            <span>
              <strong className="block text-sm">{heading}</strong>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <BottomAction label={action} onClick={onAction} />
    </div>
  );
}

function PrivacyNote() {
  return (
    <p className="mt-auto flex gap-2 pt-8 text-xs leading-5 text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
      촬영본은 기기에 임시 보관되며, 사용자가 분석을 요청한 영상만 AI 발음
      분석을 위해 서버로 전송돼요.
    </p>
  );
}

function BottomAction({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="design-action mt-5 shrink-0 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {label}
    </button>
  );
}
