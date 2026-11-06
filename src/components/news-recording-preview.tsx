"use client";

import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { NewsReviewPreview } from "./news-review-preview";
import { useEffect, useState } from "react";
import type { PracticeSessionProps } from "./recording-practice-session";
import { NewsRecordingControls, NewsRecordingReader } from "./news-recording";
import { sentencePracticeItems } from "@/lib/sentence-sequence";

export function NewsRecordingPreview({
  content,
  courseExamples,
  courseExampleIndex,
  onTitleChange,
  initiallyRecording = false,
}: PracticeSessionProps & { initiallyRecording?: boolean }) {
  const sentences = sentencePracticeItems(
    content,
    courseExamples,
    courseExampleIndex ?? 0,
  ).map((item) => item.text);
  const [recording, setRecording] = useState(initiallyRecording);
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const guard = useRecordingDiscardGuard(recording && !finished, true);
  useEffect(() => {
    onTitleChange?.("연습하기");
  }, [onTitleChange]);
  useEffect(() => {
    if (!recording || paused) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording, paused]);
  if (finished)
    return (
      <NewsReviewPreview
        onTitleChange={onTitleChange}
        sentences={sentences}
        onRestart={() => {
          setFinished(false);
          setActive(0);
          setSeconds(0);
          setPaused(false);
          setRecording(false);
        }}
      />
    );
  return (
    <div className="flex min-h-full flex-col bg-[#f2f4f6]">
      {guard.dialog}
      <NewsRecordingReader
        label={
          content.contentType === "NEWS"
            ? "뉴스 읽기"
            : content.contentType === "ANNOUNCER"
              ? "아나운서 따라 읽기"
              : content.origin === "USER_INPUT"
                ? "내 문장 연습"
                : "문장 연습"
        }
        sentences={sentences}
        active={active}
        recording={recording || finished}
        estimatedSeconds={content.estimatedSeconds}
      />
      <NewsRecordingControls
        preview
        contentId={content.id}
        stream={null}
        referenceAvailable={false}
        scriptText={sentences[active] ?? ""}
        elapsed={`${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}
        busy={false}
        last={active === sentences.length - 1}
        requesting={false}
        recording={recording}
        paused={paused}
        onTogglePause={() => setPaused((value) => !value)}
        onStart={() => {
          setActive(0);
          setSeconds(0);
          setPaused(false);
          setFinished(false);
          setRecording(true);
        }}
        onComplete={() => {
          if (active < sentences.length - 1) setActive((value) => value + 1);
          else {
            setRecording(false);
            setFinished(true);
          }
        }}
      />
    </div>
  );
}
