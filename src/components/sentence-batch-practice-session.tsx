"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PracticeContent } from "@/lib/api";
import { splitSentences } from "@/lib/sentences";
import { reportSaves } from "@/lib/report-saves";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useSentenceBatch } from "@/hooks/use-sentence-batch";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { SentenceReader } from "./sentence-reader";
import { SentenceRecordingControls } from "./sentence-recording-controls";
import { DirectAnalysisResult } from "./direct-analysis-result";
import { MicrophonePermissionNotice } from "./microphone-permission-notice";
import { ReportSaveDialog } from "./report-save-dialog";

/** Each stop finalizes one file; only the final stop enters the result waiting screen. */
export function SentenceBatchPracticeSession({
  content,
  onTitleChange,
}: {
  content: PracticeContent;
  onTitleChange?: (title: string) => void;
}) {
  const router = useRouter();
  const sentences = splitSentences(content.scriptText);
  const recorder = useAudioRecorder();
  const batch = useSentenceBatch(content.id, sentences);
  const [recordingIndex, setRecordingIndex] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const submitted = useRef<Blob | null>(null);
  const recording =
    recorder.status === "recording" || recorder.status === "stopping";
  const waiting = batch.view?.status === "PROCESSING";
  const finished = batch.view?.status === "RESULT_READY";
  const locked =
    batch.loading ||
    batch.uploading ||
    batch.restoringRecording ||
    recorder.status === "requesting";
  const active =
    recording || recorder.blob ? recordingIndex : Math.max(0, batch.nextIndex);
  const guard = useRecordingDiscardGuard(
    recording || Boolean(recorder.blob) || batch.view?.status === "RECORDING",
    true,
  );
  const message = batch.error || recorder.error;

  async function send(blob: Blob | undefined) {
    if (
      await batch.send(
        recorder.blob ? recordingIndex : Math.max(0, batch.nextIndex),
        blob,
      )
    )
      recorder.reset();
  }
  useEffect(() => {
    if (
      recorder.status !== "recorded" ||
      !recorder.blob ||
      submitted.current === recorder.blob
    )
      return;
    submitted.current = recorder.blob;
    void send(recorder.blob);
    // A finalized file is submitted once. Failed submissions require an explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.status, recorder.blob]);
  useEffect(() => {
    onTitleChange?.(
      finished ? "문장별 피드백" : waiting ? "분석 중" : "문장 연습",
    );
  }, [finished, waiting, onTitleChange]);

  async function start() {
    if (locked || recording) return;
    recorder.unlockAudio();
    const index = await batch.initialize();
    if (index == null || index < 0) return;
    setRecordingIndex(index);
    submitted.current = null;
    await recorder.start();
  }
  async function restart() {
    if (await batch.reset()) {
      submitted.current = null;
      recorder.reset();
      setRecordingIndex(0);
    }
  }
  const elapsed = Math.floor(recorder.elapsedMs / 1000);

  if (finished && batch.view?.results) {
    return (
      <div className="min-h-full bg-[#f2f4f6] pb-6">
        <header className="px-5 py-5">
          <h2 className="text-xl font-bold">이번 연습 결과</h2>
          <p className="mt-2 text-sm text-[#6b7684]">
            {sentences.length}개 문장의 분석 결과를 모두 모았어요.
          </p>
        </header>
        {batch.view.results.map((row) => (
          <section
            key={row.sequenceNo}
            className="mb-5 border-b border-[#dfe3e8] pb-4"
          >
            <h3 className="px-5 text-base font-bold">
              {row.sequenceNo}번째 문장
            </h3>
            {row.analysis.result ? (
              <DirectAnalysisResult
                result={row.analysis.result}
                content={{
                  ...content,
                  scriptText: row.scriptText,
                  referenceAudioAvailable:
                    content.referenceAudioAvailable && sentences.length === 1,
                }}
                recordingUrl={batch.urls[row.sequenceNo - 1]}
                sentenceMode
              />
            ) : (
              <div className="m-5 rounded-2xl bg-white p-5">
                <p>{row.scriptText}</p>
                <p role="status" className="mt-3 text-sm text-[#6b7684]">
                  이 문장의 분석을 완료하지 못했어요. 점수와 피드백을 만들지
                  않았습니다.
                </p>
              </div>
            )}
          </section>
        ))}
        <div className="space-y-3 px-5">
          {message && (
            <p role="alert" className="text-sm text-red-600">
              {message}
            </p>
          )}
          <p role="status" className="text-sm text-[#6b7684]">
            {batch.history === "NONE"
              ? "저장할 분석 결과가 없어요."
              : batch.history === "SAVED"
                ? "완료된 문장의 학습 이력을 저장했어요."
                : batch.history === "CONFLICT"
                  ? "이력 연결을 확인해 주세요."
                  : "결과는 준비됐어요. 학습 이력 연결을 확인하고 있어요."}
          </p>
          <button
            type="button"
            onClick={() => void restart()}
            className="h-12 w-full rounded-full border border-primary font-bold text-primary"
          >
            새로 연습하기
          </button>
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="h-12 w-full rounded-full bg-primary font-bold text-white"
          >
            완료하기
          </button>
        </div>
        <ReportSaveDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          onConfirm={async (saved) => {
            await Promise.all(
              batch
                .view!.results!.filter((row) => row.analysis.result)
                .map((row) =>
                  reportSaves.set("DIRECT", row.analysis.jobId, saved),
                ),
            );
            router.push("/home");
          }}
        />
      </div>
    );
  }
  return (
    <div className="flex min-h-full flex-col bg-[#f2f4f6]">
      {guard.dialog}
      <header className="px-5 pt-5 pb-4">
        <h2 className="text-lg font-bold">
          {batch.view?.status === "CANCELLED"
            ? "취소한 연습"
            : waiting
              ? "문장별 피드백을 모으고 있어요"
              : `${active + 1} / ${sentences.length} 문장`}
        </h2>
        <p className="mt-2 text-sm text-[#6b7684]">
          {waiting
            ? "마지막 문장의 녹음이 끝났어요. 모든 문장 분석이 끝나면 결과를 한 번에 보여 드려요."
            : "문장을 다 읽고 완료하면 녹음을 보내요. 분석을 기다리지 않고 다음 문장을 녹음할 수 있어요."}
        </p>
      </header>
      <SentenceReader
        sentences={sentences}
        activeIndex={waiting ? undefined : active}
        variant={recording ? "recording" : "reader"}
        className="mx-5 max-h-[45dvh]"
      />
      <p role="status" className="px-5 py-4 text-sm text-[#6b7684]">
        녹음 전송 {batch.view?.uploadedCount ?? 0} / {sentences.length} · 분석
        완료 {batch.view?.completedCount ?? 0} / {sentences.length}
        {batch.uploading && " · 이 문장 녹음을 보내고 있어요"}
      </p>
      {message && (
        <p
          role="alert"
          className="mx-5 rounded-2xl bg-red-50 p-4 text-sm text-red-600"
        >
          {message}
        </p>
      )}
      {recorder.status === "denied" && <MicrophonePermissionNotice />}
      {!waiting &&
        batch.view?.status !== "CANCELLED" &&
        batch.nextIndex !== -1 &&
        !recorder.blob &&
        !batch.pendingRecording && (
          <SentenceRecordingControls
            contentId={content.id}
            stream={recorder.getStream()}
            referenceAvailable={
              content.referenceAudioAvailable && sentences.length === 1
            }
            scriptText={sentences[active] ?? content.scriptText}
            elapsed={`${Math.floor(elapsed / 60)
              .toString()
              .padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`}
            busy={locked || recorder.status !== "recording"}
            last={active === sentences.length - 1}
            recording={recording}
            requesting={locked}
            onStart={() => void start()}
            onComplete={recorder.stop}
          />
        )}
      <div className="mt-auto space-y-3 px-5 py-5">
        {(recorder.blob || batch.pendingRecording) && !batch.uploading && (
          <button
            type="button"
            onClick={() => void send(recorder.blob ?? undefined)}
            className="h-12 w-full rounded-full bg-primary font-bold text-white"
          >
            같은 문장 녹음 다시 보내기
          </button>
        )}
        {(recorder.blob || batch.pendingRecording) && !batch.uploading && (
          <button
            type="button"
            onClick={() =>
              void batch
                .discardPending(
                  recorder.blob ? recordingIndex : Math.max(0, batch.nextIndex),
                )
                .then((done) => {
                  if (done) {
                    submitted.current = null;
                    recorder.reset();
                  }
                })
            }
            className="h-12 w-full rounded-full border border-primary font-bold text-primary"
          >
            접수 확인 후 이 문장 다시 녹음
          </button>
        )}
        {message && !recording && (
          <button
            type="button"
            disabled={locked}
            onClick={() => void batch.refresh()}
            className="h-12 w-full rounded-full border border-primary font-bold text-primary"
          >
            접수·분석 상태 다시 확인
          </button>
        )}
        {batch.hasAttempt && (
          <button
            type="button"
            disabled={locked || recording}
            onClick={() => void restart()}
            className="h-12 w-full rounded-full border border-[#dfe3e8] font-bold"
          >
            {waiting ? "연습 취소" : "처음부터 새로 연습"}
          </button>
        )}
      </div>
    </div>
  );
}
