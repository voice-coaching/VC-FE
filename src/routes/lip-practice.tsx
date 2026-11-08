"use client";
import { LipCapture } from "@/components/lip-capture";
import {
  LipPermissionDialog,
  LipFaceAlignment,
  type LipPermission,
} from "@/components/lip-flow-overlays";
import { LipQuickStart } from "@/components/lip-quick-start";
import {
  LIP_PRACTICE_SETS,
  type LipPracticeSet,
} from "@/lib/lip-practice-sets";
import { useRouter } from "next/navigation";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { coachingLimitNotice } from "@/lib/coaching-usage";

import {
  Check,
  ChevronRight,
  CircleAlert,
  RotateCcw,
  ShieldCheck,
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
import { PracticeAnalysisLoading } from "@/components/practice-analysis-loading";
import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { getAuthSessionVersion, subscribeAuthSession } from "@/lib/api/client";
import {
  preferredVideoMimeType,
  releaseLipResources,
  type LipClip,
  type LipPracticeStep,
} from "@/lib/lip-practice";

import { BrowserVideoConsent } from "@/components/browser-video-consent";
import { BrowserVideoAnalysisResult } from "@/components/browser-video-analysis-result";
import { BrowserVideoPracticeAttempt } from "@/lib/browser-video-practice";
import type { BrowserVideoResult } from "@/lib/api/browser-video";

const MAX_RECORDING_MS = 12_000;

type LipAnalysisPhase =
  "idle" | "preparing" | "uploading" | "analyzing" | "result" | "error";

export default function LipPractice() {
  const router = useRouter();
  const [permission, setPermission] = useState<LipPermission | null>(null);
  const [requestingMedia, setRequestingMedia] = useState(false);
  const [practiceSet, setPracticeSet] = useState<LipPracticeSet>(
    LIP_PRACTICE_SETS[1],
  );
  const prompts = practiceSet.sentences;
  const [step, setStep] = useState<LipPracticeStep>("guide");
  const discardGuard = useRecordingDiscardGuard(step === "recording", true);
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
    Partial<Record<number, BrowserVideoResult>>
  >({});
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const attemptsRef = useRef(new Map<number, BrowserVideoPracticeAttempt>());
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const clipsRef = useRef<LipClip[]>([]);
  const recordingStartedAtRef = useRef(0);
  const advanceAfterStop = useRef(false);
  const [advancing, setAdvancing] = useState(false);
  const [captureStartedAt, setCaptureStartedAt] = useState(0);
  const mounted = useRef(false);
  const mediaRequest = useRef(0);
  const mediaBusy = useRef(false);
  const analysisBusyRef = useRef(false);
  const analysisOwnerRef = useRef<AbortController | null>(null);
  const [submittedPrompts, setSubmittedPrompts] = useState<number[]>([]);
  const analysisBusy =
    analysisPhase === "preparing" ||
    analysisPhase === "uploading" ||
    analysisPhase === "analyzing";

  const canAnalyzeVideo = videoConsentAccepted;
  const consentFields = (
    <BrowserVideoConsent
      accepted={videoConsentAccepted}
      onChange={setVideoConsentAccepted}
    />
  );

  useEffect(
    () =>
      subscribeAuthSession(() => {
        setVideoConsentAccepted(false);
        analysisOwnerRef.current?.abort();
        attemptsRef.current.clear();
        const recorder = recorderRef.current;
        if (recorder) {
          recorder.onstop = null;
          recorder.ondataavailable = null;
          recorder.onerror = null;
          if (recorder.state !== "inactive") recorder.stop();
        }
        mediaRequest.current += 1;
        mediaBusy.current = false;
        setRequestingMedia(false);
        setPermission(null);
        if (stopTimerRef.current !== null)
          window.clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
        releaseLipResources(streamRef.current, clipsRef.current);
        streamRef.current = null;
        clipsRef.current = [];
        setClips([]);
        setAnalyses({});
        setPromptIndex(0);
        setSelectedClip(0);
        setAnalysisTarget(null);
        setStep("guide");
        setSubmittedPrompts([]);
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

  const startRecording = useCallback(async () => {
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
      const hasAudioTrack = stream
        .getAudioTracks()
        .some((track) => track.readyState === "live" && track.enabled);
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
        if (stopTimerRef.current !== null)
          window.clearTimeout(stopTimerRef.current);
        setError("녹화 중 문제가 발생했어요. 다시 촬영해 주세요.");
        setStep("align");
      };
      recorder.onstop = async () => {
        if (!mounted.current) return;
        const durationMs = Math.max(
          1,
          Math.round(performance.now() - recordingStartedAtRef.current),
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
          { promptIndex, blob, hasAudioTrack, url, durationMs },
        ].sort((a, b) => a.promptIndex - b.promptIndex);
        clipsRef.current = nextClips;
        setClips(nextClips);
        setAnalyses((current) => {
          const next = { ...current };
          delete next[promptIndex];
          return next;
        });
        attemptsRef.current.delete(promptIndex);
        setSubmittedPrompts((current) =>
          current.filter((index) => index !== promptIndex),
        );
        setSelectedClip(promptIndex);
        setAnalysisPhase("idle");
        setAnalysisError(null);
        if (advanceAfterStop.current) {
          advanceAfterStop.current = false;
          setAdvancing(false);
          if (promptIndex < prompts.length - 1) {
            setPromptIndex(promptIndex + 1);
          } else {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setSelectedClip(0);
            setStep("complete");
          }
        } else setStep("review");
      };
      recorderRef.current = recorder;
      if (!mounted.current) return;
      recordingStartedAtRef.current = performance.now();
      setCaptureStartedAt(Date.now());
      // Safari/iOS의 MP4는 timeslice로 조각내면 첫 조각만 재생되는 파일이
      // 만들어질 수 있으므로 stop 시점에 완성된 파일 하나를 받는다.
      recorder.start();
      setStep("recording");
      stopTimerRef.current = window.setTimeout(
        stopRecording,
        // Leave time for the recorder's stop event; validate actual elapsed time again before upload.
        MAX_RECORDING_MS - 100,
      );
    } catch {
      setError("이 기기에서 영상 녹화를 시작하지 못했어요.");
      setStep("align");
    }
  }, [promptIndex, prompts.length, stopRecording]);

  useEffect(() => {
    if (step === "recording") void startRecording();
    if (step === "align") {
      advanceAfterStop.current = false;
      setAdvancing(false);
    }
  }, [step, startRecording]);

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
    setRequestingMedia(true);
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      mediaBusy.current = false;
      setError("이 브라우저에서는 카메라와 마이크를 사용할 수 없어요.");
      setPermission("both");
      setRequestingMedia(false);
      return;
    }
    try {
      // Local camera practice works even when server video analysis is unavailable.
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
      setPermission(null);
      setStep("align");
    } catch (reason) {
      if (!mounted.current || request !== mediaRequest.current) return;
      let blocked: LipPermission = "both";
      try {
        const [camera, microphone] = await Promise.all([
          navigator.permissions.query({ name: "camera" as PermissionName }),
          navigator.permissions.query({ name: "microphone" as PermissionName }),
        ]);
        if (camera.state === "denied" && microphone.state !== "denied")
          blocked = "camera";
        if (microphone.state === "denied" && camera.state !== "denied")
          blocked = "microphone";
      } catch {
        /* Some browsers do not expose media permission queries. */
      }
      setPermission(blocked);
      const denied =
        reason instanceof DOMException &&
        (reason.name === "NotAllowedError" || reason.name === "SecurityError");
      setError(
        denied
          ? "사이트 설정에서 카메라와 마이크 권한을 허용해 주세요."
          : reason instanceof Error
            ? reason.message
            : "카메라와 마이크를 시작하지 못했어요.",
      );
    } finally {
      if (request === mediaRequest.current) {
        mediaBusy.current = false;
        setRequestingMedia(false);
      }
    }
  }

  function beginPrompt(index = promptIndex) {
    setPromptIndex(index);
    setError(null);
    setStep("countdown");
  }

  function continueFlow() {
    if (promptIndex >= prompts.length - 1) {
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

  function analyzeCurrentClip() {
    if (!currentClip || analysisBusyRef.current) return;
    releaseLipResources(streamRef.current, []);
    streamRef.current = null;
    setStep("complete");
    void analyzeSelectedClip();
  }

  async function analyzeSelectedClip() {
    if (
      !reportClip ||
      analysisBusyRef.current ||
      !mounted.current ||
      !videoConsentAccepted
    )
      return;
    const target = selectedClip;
    let attempt = attemptsRef.current.get(target);
    if (!attempt || attempt.clip.blob !== reportClip.blob) {
      attempt = new BrowserVideoPracticeAttempt(
        reportClip,
        prompts[target],
        `입 모양 연습 ${target + 1}`,
      );
      attemptsRef.current.set(target, attempt);
    }
    analysisBusyRef.current = true;
    const owner = new AbortController();
    analysisOwnerRef.current?.abort();
    analysisOwnerRef.current = owner;
    const epoch = getAuthSessionVersion();
    const active = () =>
      mounted.current &&
      !owner.signal.aborted &&
      epoch === getAuthSessionVersion();
    setAnalysisTarget(target);
    setAnalysisPhase("preparing");
    setAnalysisError(null);
    setUploadProgress(0);
    setAnalysisProgress(0);
    try {
      const result = await attempt.run(videoConsentAccepted, {
        signal: owner.signal,
        onPhase: (phase) => {
          if (!active()) return;
          setAnalysisPhase(phase);
          if (phase === "analyzing") setUploadProgress(100);
        },
        onJob: (job) => {
          if (!active()) return;
          setSubmittedPrompts((current) =>
            current.includes(target) ? current : [...current, target],
          );
          setAnalysisProgress(
            job.status === "RUNNING" ? 65 : job.status === "QUEUED" ? 40 : 32,
          );
        },
      });
      if (!active()) return;
      setAnalyses((current) => ({ ...current, [target]: result }));
      setAnalysisPhase("result");
    } catch (reason) {
      if (!active()) return;
      const coaching = coachingLimitNotice(reason);
      setAnalysisError(
        coaching
          ? `${coaching.title} ${coaching.hint}`
          : reason instanceof Error
            ? reason.message
            : "영상 분석 상태를 확인하지 못했어요.",
      );
      setAnalysisPhase("error");
    } finally {
      if (analysisOwnerRef.current === owner) {
        analysisOwnerRef.current = null;
        analysisBusyRef.current = false;
      }
    }
  }

  if (step === "guide")
    return (
      <AppShell
        nav={false}
        viewportLocked
        animateRoute={false}
        chromeColor="#f2f4f6"
        bottomChromeColor="#ffffff"
      >
        <LipQuickStart
          selected={practiceSet}
          onSelect={setPracticeSet}
          onStart={() => setPermission("request")}
        />
        <LipPermissionDialog
          state={permission}
          busy={requestingMedia}
          onClose={() => setPermission(null)}
          onAllow={() => void requestMedia()}
        />
      </AppShell>
    );

  if (step === "align")
    return (
      <AppShell
        nav={false}
        viewportLocked
        animateRoute={false}
        chromeColor="#12161f"
        bottomChromeColor="#12161f"
      >
        <LipFaceAlignment
          videoRef={previewRef}
          mirrored={mirrored}
          onReady={() => beginPrompt()}
          onClose={() => {
            releaseLipResources(streamRef.current, []);
            streamRef.current = null;
            setStep("guide");
          }}
        />
      </AppShell>
    );

  if (step === "complete" && analysisBusy)
    return (
      <AppShell
        nav={false}
        viewportLocked
        animateRoute={false}
        chromeColor="#f2f4f6"
        bottomChromeColor="#e1d9ff"
      >
        <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#f2f4f6_35%,#e1d9ff_100%)]">
          <header className="flex h-12 shrink-0 items-center justify-center text-[17px] font-bold">
            분석 중
          </header>
          <button
            type="button"
            className="mx-5 mt-3 min-h-11 text-sm font-bold"
            onClick={() => {
              analysisOwnerRef.current?.abort();
              setAnalysisError(
                "분석 대기를 중단했어요. 같은 촬영본에서 처리 상태를 다시 확인할 수 있어요.",
              );
              setAnalysisPhase("error");
            }}
          >
            분석 대기 중단
          </button>
          <PracticeAnalysisLoading
            uploading={
              analysisPhase === "preparing" || analysisPhase === "uploading"
            }
            stepProgress={
              analysisPhase === "uploading"
                ? Math.min(32, uploadProgress * 0.32)
                : analysisProgress
            }
          />
        </div>
      </AppShell>
    );

  if (step === "complete" && analysisPhase === "result" && selectedAnalysis)
    return (
      <AppShell
        nav={false}
        animateRoute={false}
        chromeColor="#f2f4f6"
        bottomChromeColor="#ffffff"
      >
        <div className="min-h-full bg-[#f2f4f6]">
          <header className="flex h-12 items-center px-2">
            <button
              type="button"
              onClick={() => setAnalysisPhase("idle")}
              aria-label="촬영 확인으로 돌아가기"
              className="grid size-10 place-items-center"
            >
              <Image
                src="/figma/lip-quick-start/back.svg"
                width={24}
                height={24}
                alt=""
              />
            </button>
            <h1 className="flex-1 text-center text-[17px] font-bold">피드백</h1>
            <span className="size-10" />
          </header>
          <div className="flex items-center justify-center gap-2 px-5 text-[13px]">
            <strong className="text-[#6346f6]">입모양 따라 하기</strong>
            <span className="text-[#8b95a1]">{practiceSet.title}</span>
          </div>
          {analysisError && (
            <p role="status" className="px-5 pt-3 text-sm">
              {analysisError}
            </p>
          )}
          {selectedAnalysis && (
            <BrowserVideoAnalysisResult
              result={selectedAnalysis}
              title={practiceSet.title}
              scriptText={prompts[selectedClip]}
              recordingUrl={reportClip?.url}
            />
          )}
          <footer className="bg-white px-5 py-3">
            <button
              className="design-action"
              onClick={() => router.push("/home")}
            >
              완료하기
            </button>
          </footer>
        </div>
      </AppShell>
    );

  if (step === "countdown" || step === "recording")
    return (
      <AppShell
        nav={false}
        viewportLocked
        animateRoute={false}
        chromeColor="#0b0d10"
        bottomChromeColor="#0b0d10"
      >
        {discardGuard.dialog}
        <LipCapture
          videoRef={previewRef}
          mirrored={mirrored}
          prompts={prompts}
          index={promptIndex}
          countdown={step === "countdown" ? countdown : null}
          startedAt={captureStartedAt}
          busy={advancing}
          onNext={() => {
            if (
              advanceAfterStop.current ||
              recorderRef.current?.state !== "recording"
            )
              return;
            advanceAfterStop.current = true;
            setAdvancing(true);
            stopRecording();
          }}
        />
      </AppShell>
    );

  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#f2f4f6"
      bottomChromeColor="#ffffff"
    >
      {discardGuard.dialog}
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f8fa]">
        <header className="relative z-20 flex h-16 shrink-0 items-center justify-between px-5">
          {step === "setup" ? (
            <button
              aria-label="설정 닫기"
              className="flex size-11 items-center justify-center"
              onClick={() => setStep("guide")}
            >
              <Image
                src="/figma/lip-quick-start/back.svg"
                width={24}
                height={24}
                alt=""
              />
            </button>
          ) : (
            <BackButton
              fallback="/home"
              label="입 모양 연습 닫기"
              className="flex size-11 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur"
            >
              <X className="size-5" />
            </BackButton>
          )}
          <p className="text-sm font-bold">
            {step === "tips" || step === "setup"
              ? "입 모양 따라 하기"
              : step === "complete"
                ? "촬영 완료"
                : `${promptIndex + 1}/${prompts.length}`}
          </p>
          <span className="size-11" aria-hidden="true" />
        </header>

        {step === "tips" ? (
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
                  className="size-6 accent-[#6346f6]"
                />
              </label>
              {consentFields}
            </section>
            <PrivacyNote />
            <BottomAction label="설정 완료" onClick={() => setStep("guide")} />
          </div>
        ) : step === "permission" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-6 text-center">
            <span className="mx-auto mt-auto flex size-24 shrink-0 items-center justify-center rounded-[32px] bg-[#f1edff] text-primary">
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
                {clips.length === prompts.length
                  ? `${prompts.length}개 문장을 모두 촬영했어요`
                  : `${clips.length}개 문장을 촬영했어요`}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                문장을 선택해 촬영 영상을 확인하고 AI 발음 분석을 시작하세요.
              </p>
            </section>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {clips.map(({ promptIndex: index }) => (
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
              {prompts[selectedClip]}
            </p>

            {!selectedAnalysis && !analysisBusy ? consentFields : null}

            {analysisTarget === selectedClip && analysisBusy ? (
              <PracticeAnalysisLoading
                stepProgress={
                  analysisPhase === "uploading"
                    ? Math.min(32, uploadProgress * 0.32)
                    : analysisProgress
                }
                uploading={analysisPhase === "uploading"}
              />
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
                  disabled={!canAnalyzeVideo}
                  onClick={() => void analyzeSelectedClip()}
                  className="mt-4 min-h-12 w-full rounded-full bg-primary text-sm font-bold text-white disabled:opacity-45"
                >
                  {submittedPrompts.includes(selectedClip)
                    ? "처리 상태 다시 확인"
                    : "다시 요청하기"}
                </button>
              </section>
            ) : selectedAnalysis ? (
              <div className="mt-5">
                <BrowserVideoAnalysisResult
                  result={selectedAnalysis}
                  title={practiceSet.title}
                  scriptText={prompts[selectedClip]}
                  recordingUrl={reportClip?.url}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void analyzeSelectedClip()}
                disabled={!reportClip || !canAnalyzeVideo}
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
            {clips.length < prompts.length ? (
              <button
                type="button"
                disabled={analysisBusy}
                onClick={() => {
                  const next = prompts.findIndex(
                    (_, index) =>
                      !clips.some((clip) => clip.promptIndex === index),
                  );
                  if (next < 0) return;
                  setPromptIndex(next);
                  setAnalysisPhase("idle");
                  setAnalysisTarget(null);
                  setAnalysisError(null);
                  void requestMedia();
                }}
                className="mt-3 min-h-12 w-full rounded-full border border-border bg-white text-sm font-bold disabled:opacity-45"
              >
                남은 문장 연습하기
              </button>
            ) : null}
            <button
              type="button"
              className="design-action mt-3"
              onClick={() => router.push("/home")}
            >
              완료
            </button>
          </div>
        ) : (
          <CameraStage mirrored={mirrored} videoRef={previewRef}>
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
                {consentFields}
                <button
                  type="button"
                  onClick={analyzeCurrentClip}
                  disabled={!currentClip.blob.size || !canAnalyzeVideo}
                  className="design-action mt-4 shrink-0 disabled:cursor-not-allowed disabled:!bg-[#e5e8eb] disabled:!text-[#8b95a1]"
                >
                  AI 발음 분석하기
                </button>
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
                    className="flex min-h-14 items-center justify-center gap-2 rounded-full border border-border bg-white text-sm font-bold"
                  >
                    {promptIndex === prompts.length - 1
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
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f1edff] text-sm font-bold text-primary">
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
      촬영 영상은 기기에 임시 보관되며, 분석을 요청하면 선택한 촬영본의 영상과
      내장 음성이 발음·입술 움직임 분석을 위해 AI 서버로 직접 전송돼요.
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
      className="design-action mt-5 shrink-0 disabled:cursor-not-allowed disabled:!bg-[#e5e8eb] disabled:!text-[#8b95a1] disabled:!shadow-none disabled:opacity-100"
    >
      {label}
    </button>
  );
}
