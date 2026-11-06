"use client";
import type { Id } from "@/lib/api";
import { NewsRecordingControls } from "./news-recording";

export function SentenceRecordingControls(props: {
  contentId: Id;
  stream: MediaStream | null;
  referenceAvailable: boolean;
  scriptText: string;
  elapsed: string;
  busy: boolean;
  last: boolean;
  onComplete: () => void;
  recording: boolean;
  requesting: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onStart: () => void;
}) {
  return <NewsRecordingControls {...props} />;
}
