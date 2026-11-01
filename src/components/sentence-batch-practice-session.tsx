"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PracticeContent } from "@/lib/api";
import { splitSentences } from "@/lib/sentences";
import { reportSaves } from "@/lib/report-saves";
import { useSentenceRecorder } from "@/hooks/use-sentence-recorder";
import { useSentenceBatch } from "@/hooks/use-sentence-batch";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { SentenceReader } from "./sentence-reader";
import { PracticeAnalysisLoading } from "./practice-analysis-loading";
import { SentenceRecordingControls } from "./sentence-recording-controls";
import { DirectAnalysisResult } from "./direct-analysis-result";
import { MicrophonePermissionNotice } from "./microphone-permission-notice";
import { ReportSaveDialog } from "./report-save-dialog";

/** Keep sentence capture continuous; collect feedback only after local capture finishes. */
export function SentenceBatchPracticeSession({
  content,
  onTitleChange,
}: {
  content: PracticeContent;
  onTitleChange?: (title: string) => void;
}) {
  const router = useRouter();
  const sentences = splitSentences(content.scriptText);
  const batch = useSentenceBatch(content.id, sentences);
  const recorder = useSentenceRecorder(batch.enqueue);
  const [saveOpen, setSaveOpen] = useState(false);
  const recording = recorder.status === "recording";
  const waiting = batch.localComplete && recorder.status !== "recording";
  const finished =
    batch.view?.status === "RESULT_READY" &&
    !recording &&
    recorder.status !== "requesting";
  // Uploads and inference never disable the microphone or drive its sentence cursor.
  const locked = batch.loading || recorder.status === "requesting";
  const active = recording ? recorder.index : Math.max(0, batch.nextIndex);
  const shouldConfirmExit =
    !finished &&
    (sentences.length > 1 ||
      recorder.status === "requesting" ||
      recording ||
      batch.savingRecordings ||
      batch.hasAttempt);
  const guard = useRecordingDiscardGuard(shouldConfirmExit, true);
  const message = recorder.error || (!recording ? batch.error : null);
  useEffect(() => {
    onTitleChange?.(
      finished ? "문장별 피드백" : waiting ? "분석 중" : "문장 연습",
    );
  }, [finished, waiting, onTitleChange]);
  function start() {
    if (locked || recording) return;
    const index = batch.begin();
    if (index != null) void recorder.start(index);
  }
  async function restart() {
    recorder.reset();
    await batch.reset();
  }
  async function retake() {
    const index = batch.retryIndex;
    if (index != null && (await batch.allowRetake(index)))
      void recorder.start(index);
  }
  const elapsed = Math.floor(recorder.elapsedMs / 1000);

  if (finished && batch.view?.results) {
    return (
      <div className="min-h-full bg-[#f2f4f6] pb-6">
        {guard.dialog}
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
      {!waiting && (
        <header className="px-5 pt-5 pb-4">
          <h2 className="text-lg font-bold">
            {batch.view?.status === "CANCELLED"
              ? "취소한 연습"
              : `${active + 1} / ${sentences.length} 문장`}
          </h2>
          <p className="mt-2 text-sm text-[#6b7684]">
            다 읽으면 다음 문장을 눌러 이어서 녹음해 주세요. 피드백은 모든 문장을 마친 뒤 보여 드려요.
          </p>
        </header>
      )}
      {!waiting && (
        <SentenceReader
          sentences={sentences}
          pageIndex={active}
          activeIndex={recording ? active : undefined}
          variant={recording ? "recording" : "reader"}
          className="mx-5 max-h-[45dvh]"
        />
      )}
      {!waiting && (
        <p role="status" className="px-5 py-4 text-sm text-[#6b7684]">
          {`녹음 완료 ${batch.capturedCount} / ${sentences.length} 문장`}
        </p>
      )}
      {waiting && <PracticeAnalysisLoading uploading={batch.uploading} />}
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
        batch.nextIndex !== -1 && (
          <SentenceRecordingControls
            paused={recorder.paused}
            onTogglePause={recorder.togglePause}
            contentId={content.id}
            stream={recorder.getStream()}
            referenceAvailable={
              content.referenceAudioAvailable && sentences.length === 1
            }
            scriptText={sentences[active] ?? content.scriptText}
            elapsed={`${Math.floor(elapsed / 60)
              .toString()
              .padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`}
            busy={locked || recorder.splitting || !recording}
            last={active === sentences.length - 1}
            recording={recording}
            requesting={locked}
            onStart={start}
            onComplete={() => void recorder.advance()}
          />
        )}
      <div className="mt-auto space-y-3 px-5 py-5">
        {waiting && batch.error && (
          <button
            type="button"
            disabled={batch.uploading}
            onClick={batch.refresh}
            className="h-12 w-full rounded-full bg-primary font-bold text-white"
          >
            전송·분석 상태 다시 확인
          </button>
        )}
        {waiting && batch.retryIndex != null && (
          <button
            type="button"
            disabled={batch.uploading}
            onClick={() => void retake()}
            className="h-12 w-full rounded-full border border-primary font-bold text-primary"
          >
            {batch.retryIndex + 1}번째 문장 다시 녹음
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
