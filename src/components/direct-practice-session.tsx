"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnalysisLoadingMessage } from "@/components/analysis-loading-message";
import { DirectAnalysisResult } from "@/components/direct-analysis-result";
import { ReferencePlayer } from "@/components/reference-player";
import { SentenceReader } from "@/components/sentence-reader";
import {
  prepareAudioForAnalysis,
  useAudioRecorder,
} from "@/hooks/use-audio-recorder";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import type { PracticeContent } from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import {
  cancelDirect,
  findDirect,
  linkDirectHistory,
  observeDirect,
  submitDirect,
  type DirectView,
} from "@/lib/direct-analysis";
import { splitSentences } from "@/lib/sentences";

type Attempt = { attemptId: string; jobId?: string; historyClaim?: string };

const CONTENT_LABEL: Record<PracticeContent["contentType"], string> = {
  NEWS: "뉴스 읽기",
  SENTENCE: "문장 연습",
  ANNOUNCER: "아나운서 따라 읽기",
  CLASS_PRACTICE: "클래스",
};

export function DirectPracticeSession({
  content,
}: {
  content: PracticeContent;
}) {
  const router = useRouter();
  const recorder = useAudioRecorder();
  const [view, setView] = useState<DirectView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState("PENDING");
  const [activeSentence, setActiveSentence] = useState(0);
  const [hasAttempt, setHasAttempt] = useState(false);
  const [sentenceBoundaries, setSentenceBoundaries] = useState<number[]>([0]);
  const controller = useRef<AbortController | null>(null);
  const attempt = useRef<Attempt | null>(null);
  const sentences = splitSentences(content.scriptText);
  const key = `direct-analysis:${getAuthenticatedUserId()}:${content.id}`;
  const discardGuard = useRecordingDiscardGuard(
    recorder.status === "recording" ||
      recorder.status === "stopping" ||
      recorder.status === "recorded",
    true,
  );

  function save(value: Attempt) {
    attempt.current = value;
    setHasAttempt(true);
    localStorage.setItem(key, JSON.stringify(value));
  }

  function update(next: DirectView) {
    setView(next);
    if (!["RUNNING", "QUEUED"].includes(next.status)) setBusy(false);
  }

  async function observe(jobId: string, signal: AbortSignal) {
    setBusy(true);
    try {
      await observeDirect(jobId, signal, update);
    } catch (reason) {
      if (!signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "결과 연결이 끊겼습니다. 다시 확인해 주세요.",
        );
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved: Attempt = JSON.parse(raw);
        attempt.current = saved;
        setHasAttempt(true);
        if (saved.jobId) void observe(saved.jobId, current.signal);
        else
          void findDirect(saved.attemptId, current.signal)
            .then((reply) => {
              if (current.signal.aborted) return;
              save({ ...saved, jobId: reply.jobId });
              update(reply);
              void observe(reply.jobId, current.signal);
            })
            .catch(() => {
              if (!current.signal.aborted)
                setError(
                  "이전 요청 접수를 확인하지 못했습니다. 새 녹음 전 결과를 다시 확인해 주세요.",
                );
            });
      }
    } catch {
      setError("이전 작업 정보를 복구하지 못했습니다.");
    }
    return () => current.abort();
    // Key owns this component's user/content identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (view?.status !== "RESULT_READY" || !attempt.current?.historyClaim)
      return;
    const current = new AbortController();
    const saved = attempt.current;
    let timer: ReturnType<typeof setTimeout>;
    async function sync() {
      try {
        const result = await linkDirectHistory(
          view!.jobId,
          saved.historyClaim!,
          current.signal,
        );
        if (current.signal.aborted) return;
        setHistory(result.state);
        if (["SAVED", "CONFLICT"].includes(result.state)) return;
      } catch {
        if (current.signal.aborted) return;
        setHistory("RETRYING");
      }
      timer = setTimeout(() => void sync(), 5000);
    }
    void sync();
    return () => {
      current.abort();
      clearTimeout(timer);
    };
  }, [view]);

  async function submit() {
    if (!recorder.blob || busy) return;
    setBusy(true);
    setError(null);
    const current = new AbortController();
    controller.current?.abort();
    controller.current = current;
    try {
      const prepared = await prepareAudioForAnalysis(recorder.blob, [
        "audio/wav",
      ]);
      const selected = attempt.current ?? {
        attemptId: crypto.randomUUID(),
        historyClaim: btoa(
          Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
            String.fromCharCode(byte),
          ).join(""),
        )
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replace(/=+$/, ""),
      };
      save(selected);
      if (!selected.historyClaim)
        throw new Error("이력 연결 정보를 확인하지 못했습니다.");
      const reply = await submitDirect(
        prepared.blob,
        content.scriptText,
        Number(content.id) || null,
        selected.attemptId,
        selected.historyClaim,
        current.signal,
      );
      if (current.signal.aborted) return;
      save({ ...selected, jobId: reply.jobId });
      update(reply);
      await observe(reply.jobId, current.signal);
    } catch (reason) {
      if (!current.signal.aborted) {
        setError(
          reason instanceof Error
            ? reason.message
            : "분석 요청에 실패했습니다.",
        );
        setBusy(false);
      }
    }
  }

  function clearAttempt() {
    controller.current?.abort();
    attempt.current = null;
    setHasAttempt(false);
    localStorage.removeItem(key);
    setView(null);
    setBusy(false);
    setError(null);
    setHistory("PENDING");
    setActiveSentence(0);
    setSentenceBoundaries([0]);
    recorder.reset();
  }

  async function startNewRecording() {
    clearAttempt();
    await recorder.start();
  }

  async function recover() {
    if (!attempt.current) return;
    const current = new AbortController();
    controller.current?.abort();
    controller.current = current;
    setError(null);
    setBusy(true);
    try {
      const reply = await findDirect(attempt.current.attemptId, current.signal);
      if (current.signal.aborted) return;
      save({ ...attempt.current, jobId: reply.jobId });
      update(reply);
      await observe(reply.jobId, current.signal);
    } catch {
      if (!current.signal.aborted)
        setError(
          "접수된 분석을 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.",
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }

  const phase = view?.result
    ? "result"
    : busy
      ? "analyzing"
      : recorder.status === "recording" || recorder.status === "stopping"
        ? "recording"
        : recorder.blob
          ? "review"
          : "idle";
  const failed = view?.status === "FAILED" || view?.status === "CANCELLED";
  const message = error || recorder.error;
  const formatElapsed = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1_000);
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  if (phase === "result" && view?.result) {
    return (
      <div className="flex min-h-full flex-col bg-[#f2f4f6]">
        <div className="space-y-5 px-5 py-4">
          <p className="flex min-w-0 max-w-full items-center justify-center gap-2 text-[13px] leading-[18px]">
            <b className="shrink-0 text-primary">
              {CONTENT_LABEL[content.contentType]}
            </b>
            <span className="h-2.5 w-px shrink-0 bg-[#e5e8eb]" />
            <span className="min-w-0 max-w-[240px] truncate font-medium text-[#8b95a1]">
              {content.title}
            </span>
          </p>
          <DirectAnalysisResult result={view.result} />
          <section className="rounded-2xl bg-white p-4">
            <h2 className="text-[12px] leading-4 font-bold text-[#8b95a1]">
              연습 문장
            </h2>
            <p className="mt-1.5 text-[15px] leading-[1.5] font-medium">
              {content.scriptText}
            </p>
            {recorder.previewUrl ? (
              <div className="mt-3.5">
                <ReferencePlayer
                  source={recorder.previewUrl}
                  title="내 녹음 전체 듣기"
                  buttonTone="primary"
                />
              </div>
            ) : null}
          </section>
          <p
            role="status"
            className="rounded-2xl bg-white px-4 py-3 text-center text-[12px] leading-5 text-[#6b7684]"
          >
            {history === "SAVED"
              ? "학습 이력에 저장했어요."
              : history === "CONFLICT"
                ? "결과는 준비됐지만 학습 이력 연결을 확인해 주세요."
                : "결과가 준비됐어요. 학습 이력에 저장하고 있습니다."}
          </p>
        </div>
        <div className="sticky bottom-0 mt-auto border-t border-[#e5e8eb] bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="h-14 w-full rounded-full bg-primary text-[16px] leading-6 font-bold text-white"
          >
            완료하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f2f4f6]">
      {discardGuard.dialog}
      {(phase === "idle" || phase === "recording") && (
        <>
          <div className="flex shrink-0 items-center px-5 pt-3 pb-4">
            <span className="rounded-full bg-[#edf2ff] px-2.5 py-[5px] text-[12px] leading-4 font-medium text-[#1f55e0]">
              {CONTENT_LABEL[content.contentType]}
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
              onClick={() => void startNewRecording()}
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
          {message ? (
            <p
              role="alert"
              className="w-full rounded-2xl bg-red-50 px-4 py-3 text-center text-xs leading-5 text-red-600"
            >
              {message}
            </p>
          ) : null}
          {hasAttempt ? (
            <button
              type="button"
              onClick={() => void recover()}
              className="min-h-11 px-5 text-sm font-bold text-primary"
            >
              이전 분석 상태 다시 확인
            </button>
          ) : null}
        </div>
      )}

      {phase === "recording" && (
        <div className="mt-auto flex flex-col items-center gap-4 px-5 pb-16">
          <div
            className="flex h-12 items-center justify-center gap-1"
            aria-hidden="true"
          >
            {[
              10, 18, 30, 22, 42, 27, 13, 33, 48, 28, 17, 38, 23, 43, 20, 32,
              12, 27, 18, 10,
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
              {recorder.status === "stopping" ? "녹음 마무리 중" : "녹음 중"}
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
                  setSentenceBoundaries((current) => {
                    const next = [...current];
                    next[activeSentence + 1] = recorder.getElapsedMs() / 1_000;
                    return next;
                  });
                  setActiveSentence((current) => current + 1);
                } else recorder.stop();
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
          <p className="text-center text-[14px] leading-5 font-medium text-[#8b95a1]">
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
                      startSeconds={sentenceBoundaries[index] ?? 0}
                      endSeconds={
                        sentenceBoundaries[index + 1] ??
                        recorder.durationMs / 1_000
                      }
                      buttonTone="neutral"
                    />
                  </div>
                </div>
              ))}
            </div>
            {message || failed ? (
              <p
                role="alert"
                className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-center text-xs leading-5 text-red-600"
              >
                {message ||
                  (view?.status === "CANCELLED"
                    ? "분석을 취소했어요. 새로 녹음해 주세요."
                    : "분석을 완료하지 못했습니다. 새로 녹음해 주세요.")}
              </p>
            ) : null}
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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={clearAttempt}
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
                onClick={() =>
                  void (attempt.current && !failed ? recover() : submit())
                }
                className="h-[52px] rounded-full bg-[#2f6bff] text-[15px] leading-[22px] font-bold text-white"
              >
                {hasAttempt && !failed ? "분석 상태 확인" : "분석 요청"}
              </button>
            </div>
          </div>
        </>
      )}

      {phase === "analyzing" && (
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
          <p
            role="status"
            className="mt-5 min-h-14 w-full shrink-0 px-5 text-center text-[20px] leading-7 font-bold text-[#191f28]"
          >
            <AnalysisLoadingMessage />
          </p>
          <div className="mt-9 w-[225px] rounded-[18px] bg-white px-3 py-2 shadow-[0_3px_5px_rgba(23,23,23,0.05)]">
            {["음성 품질 확인", "텍스트로 변환", "발음과 억양 분석"].map(
              (label, index) => {
                const activeStep = view?.status === "RUNNING" ? 2 : 1;
                const complete = index < activeStep;
                const current = index === activeStep;
                return (
                  <div key={label} className="flex h-14 items-center gap-3">
                    <span className="relative flex h-14 w-7 shrink-0 items-center justify-center">
                      {index > 0 ? (
                        <span
                          className={`absolute top-0 left-[13px] h-5 w-0.5 ${complete || current ? "bg-[#2f6bff]" : "bg-[#e5e8eb]"}`}
                        />
                      ) : null}
                      {index < 2 ? (
                        <span
                          className={`absolute bottom-0 left-[13px] h-5 w-0.5 ${complete ? "bg-[#2f6bff]" : "bg-[#e5e8eb]"}`}
                        />
                      ) : null}
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
          {view?.jobId ? (
            <div className="mt-6 flex items-center gap-4 pb-6 text-[13px] font-bold">
              <button
                type="button"
                onClick={() => {
                  const current = new AbortController();
                  controller.current?.abort();
                  controller.current = current;
                  void observe(view.jobId, current.signal);
                }}
                className="min-h-11 text-primary"
              >
                분석 상태 다시 확인
              </button>
              <button
                type="button"
                onClick={() =>
                  void cancelDirect(view.jobId)
                    .then((next) => {
                      update(next);
                      setError("분석을 취소했어요. 새로 녹음해 주세요.");
                    })
                    .catch(() => setError("취소 여부를 확인하지 못했습니다."))
                }
                className="min-h-11 text-[#8b95a1]"
              >
                분석 취소
              </button>
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      )}
    </div>
  );
}
