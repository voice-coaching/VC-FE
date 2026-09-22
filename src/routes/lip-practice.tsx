"use client";

import {
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  Mic,
  RotateCcw,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppShell } from "@/components/app-shell";
import {
  LIP_PRACTICE_PROMPTS,
  preferredVideoMimeType,
  releaseLipResources,
  type LipClip,
  type LipPracticeStep,
} from "@/lib/lip-practice";

const MAX_RECORDING_MS = 12_000;

export default function LipPractice() {
  const router = useRouter();
  const [step, setStep] = useState<LipPracticeStep>("guide");
  const [promptIndex, setPromptIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [clips, setClips] = useState<LipClip[]>([]);
  const [selectedClip, setSelectedClip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(true);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const clipsRef = useRef<LipClip[]>([]);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(
    () => () => {
      if (stopTimerRef.current !== null)
        window.clearTimeout(stopTimerRef.current);
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") recorder.stop();
      releaseLipResources(streamRef.current, clipsRef.current);
    },
    [],
  );

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
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      setError("이 브라우저에서는 영상 녹화를 지원하지 않아요.");
      setStep("permission");
      return;
    }
    const mimeType = preferredVideoMimeType((value) =>
      MediaRecorder.isTypeSupported(value),
    );
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      setError("녹화 중 문제가 발생했어요. 다시 촬영해 주세요.");
      setStep("align");
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });
      if (blob.size === 0) {
        setError("녹화된 영상이 없어요. 다시 촬영해 주세요.");
        setStep("align");
        return;
      }
      const url = URL.createObjectURL(blob);
      setClips((current) => {
        const previous = current.find(
          (clip) => clip.promptIndex === promptIndex,
        );
        if (previous) URL.revokeObjectURL(previous.url);
        return [
          ...current.filter((clip) => clip.promptIndex !== promptIndex),
          { promptIndex, blob, url },
        ].sort((a, b) => a.promptIndex - b.promptIndex);
      });
      setSelectedClip(promptIndex);
      setStep("review");
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setStep("recording");
    stopTimerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
  }, [promptIndex, stopRecording]);

  useEffect(() => {
    if (step !== "countdown") return;
    setCountdown(3);
    const interval = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(interval);
          window.setTimeout(startRecording, 240);
          return 0;
        }
        return value - 1;
      });
    }, 800);
    return () => window.clearInterval(interval);
  }, [startRecording, step]);

  async function requestMedia() {
    setStep("permission");
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("이 브라우저에서는 카메라와 마이크를 사용할 수 없어요.");
      return;
    }
    try {
      releaseLipResources(streamRef.current, []);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setStep("align");
    } catch (reason) {
      setError(
        reason instanceof DOMException && reason.name === "NotAllowedError"
          ? "카메라와 마이크 권한이 필요해요. 브라우저 설정에서 권한을 허용해 주세요."
          : "카메라와 마이크를 시작하지 못했어요.",
      );
    }
  }

  function beginPrompt(index = promptIndex) {
    setPromptIndex(index);
    setError(null);
    setStep("countdown");
  }

  function continueFlow() {
    if (promptIndex >= LIP_PRACTICE_PROMPTS.length - 1) {
      setSelectedClip(0);
      setStep("unavailable");
      return;
    }
    setPromptIndex((value) => value + 1);
    setStep("align");
  }

  const currentClip = clips.find((clip) => clip.promptIndex === promptIndex);
  const reportClip = clips.find((clip) => clip.promptIndex === selectedClip);

  return (
    <AppShell nav={false} viewportLocked>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f8fa]">
        <header className="relative z-20 flex h-16 shrink-0 items-center justify-between px-5">
          <button
            type="button"
            onClick={() => router.push("/home")}
            aria-label="입모양 연습 닫기"
            className="flex size-11 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur"
          >
            <X className="size-5" />
          </button>
          <p className="text-sm font-bold">
            {step === "guide" || step === "tips" || step === "setup"
              ? "입모양 연습"
              : step === "unavailable"
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
            description="5개의 짧은 문장을 촬영해요. 영상은 서버에 업로드하지 않고 이 기기 메모리에서만 사용합니다."
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
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-6">
            <h1 className="mt-5 text-[26px] leading-9 font-bold">
              촬영 화면을 설정해요
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              전면 카메라는 거울처럼 표시할 수 있어요.
            </p>
            <section className="design-card mt-8 !p-4">
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
            </section>
            <PrivacyNote />
            <BottomAction
              label="카메라·마이크 권한 확인"
              onClick={() => void requestMedia()}
            />
          </div>
        ) : step === "permission" ? (
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 text-center">
            <span className="mx-auto mt-auto flex size-24 items-center justify-center rounded-[32px] bg-[#eaf4ff] text-primary">
              <ShieldCheck className="size-11" />
            </span>
            <h1 className="mt-7 text-2xl font-bold">권한을 확인하고 있어요</h1>
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
              <span className="mx-auto mt-6 size-7 animate-spin rounded-full border-3 border-primary/20 border-t-primary" />
            )}
            <div className="mt-auto">
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
        ) : step === "unavailable" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
            <section className="pt-5 text-center">
              <span className="mx-auto flex size-20 items-center justify-center rounded-[28px] bg-[#eaf8f3] text-[#00a878]">
                <Check className="size-10" />
              </span>
              <h1 className="mt-5 text-2xl font-bold">
                5개 문장을 모두 촬영했어요
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                입모양 자동 분석은 준비 중이에요. 촬영한 영상은 지금 이
                화면에서만 확인할 수 있어요.
              </p>
            </section>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {LIP_PRACTICE_PROMPTS.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedClip(index)}
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
            <section className="mt-4 rounded-[20px] border border-dashed border-[#bfdcff] bg-[#f4f9ff] p-4">
              <div className="flex gap-3">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <strong className="text-sm">분석 기능 준비 중</strong>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    실제 분석 데이터 계약이 제공되면 입술 움직임과 발음 피드백이
                    이곳에 표시됩니다.
                  </p>
                </div>
              </div>
            </section>
            <button
              type="button"
              onClick={() => {
                setPromptIndex(selectedClip);
                setStep("align");
              }}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-white text-sm font-bold"
            >
              <RotateCcw className="size-4" />
              선택한 문장 다시 촬영
            </button>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="design-action mt-3"
            >
              완료
            </button>
          </div>
        ) : (
          <CameraStage mirrored={mirrored} videoRef={previewRef}>
            {step === "align" ? (
              <div className="absolute inset-x-5 bottom-6 z-10 rounded-[24px] bg-white/94 p-5 text-center shadow-xl backdrop-blur">
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
              <div className="absolute inset-x-5 bottom-6 z-10 rounded-[24px] bg-black/70 p-5 text-center text-white backdrop-blur">
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
    <div className="flex min-h-0 flex-1 flex-col px-5 pb-6">
      <span className="mt-14 flex size-20 items-center justify-center rounded-[28px] bg-[#eaf4ff] text-primary">
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
    <div className="flex min-h-0 flex-1 flex-col px-5 pb-6">
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
      영상은 업로드하지 않으며 새로고침하거나 화면을 나가면 즉시 사라져요.
    </p>
  );
}

function BottomAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="design-action mt-5 shrink-0"
    >
      {label}
    </button>
  );
}
