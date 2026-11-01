"use client";

import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { DirectPracticeSession } from "./direct-practice-session";
import {
  RecordingPracticeSession,
  type PracticeSessionProps,
} from "./recording-practice-session";
import { TitleExamSession } from "./title-exam-session";
import { directAnalysisEnabled } from "@/lib/direct-analysis";
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

  if (titleExamId) {
    return <TitleExamSession key={identity} {...props} examId={titleExamId} />;
  }

  if (
    directAnalysisEnabled &&
    !params.get("courseId") &&
    !params.get("sessionId") &&
    !params.get("courseStepId")
  ) {
    return (
      <DirectPracticeSession
        key={identity}
        content={props.content}
        onTitleChange={props.onTitleChange}
      />
    );
  }

  return <RecordingPracticeSession key={identity} {...props} />;
}
