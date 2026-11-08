"use client";

import { AnalysisView } from "./analysis-view";
import type { BrowserVideoResult } from "@/lib/api/browser-video";
import { browserVideoPresentation } from "@/lib/browser-video-presentation";

export function BrowserVideoAnalysisResult({
  result,
  title,
  scriptText,
  recordingUrl,
}: {
  result: BrowserVideoResult;
  title: string;
  scriptText: string;
  recordingUrl?: string;
}) {
  const completed = result.status === "COMPLETED" && !result.failure;
  return (
    <AnalysisView
      analysis={browserVideoPresentation(result)}
      segments={[]}
      content={{
        id: result.jobId,
        title,
        scriptText,
        contentType: "SENTENCE",
        referenceAudioAvailable: false,
      }}
      recordingUrl={recordingUrl}
      isCameraPractice
      corrections={completed ? result.coaching.items : []}
      lipVisual={completed ? result.visual : undefined}
      reportParameter={`videoReport-${result.jobId}`}
    />
  );
}
