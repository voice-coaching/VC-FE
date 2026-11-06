"use client";

import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  RecordingPracticeSession,
  type PracticeSessionProps,
} from "./recording-practice-session";
import { NewsRecordingPreview } from "./news-recording-preview";
import { TitleExamSession } from "./title-exam-session";
import { SentencePracticeSequence } from "./sentence-practice-sequence";
import { getAuthSessionVersion, subscribeAuthSession } from "@/lib/api/client";

export function PracticeSession(props: PracticeSessionProps) {
  const epoch = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionVersion,
    () => 0,
  );
  const params = useSearchParams();
  const titleExamId = params.get("titleExamId");
  const identity = JSON.stringify([
    epoch,
    props.content.id,
    props.courseExamples?.revision,
    props.courseExampleIndex,
    params.get("sessionId"),
    params.get("courseStepId"),
    titleExamId,
  ]);

  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_RECORDING_UI_PREVIEW === "1" &&
    !titleExamId
  ) {
    return <NewsRecordingPreview key={identity} {...props} />;
  }

  if (titleExamId) {
    return <TitleExamSession key={identity} {...props} examId={titleExamId} />;
  }

  // New practice runs submit each sentence through the authenticated API.
  // Existing session URLs keep their original single-session recovery path.
  if (!props.localOnly && !params.get("sessionId")) {
    return <SentencePracticeSequence key={identity} {...props} />;
  }

  return <RecordingPracticeSession key={identity} {...props} />;
}
