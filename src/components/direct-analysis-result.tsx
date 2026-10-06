"use client";

import {
  AnalysisView,
  type AnalysisViewContent,
} from "@/components/analysis-view";
import type { DirectResult } from "@/lib/direct-analysis";
import { directAnalysisPresentation } from "@/lib/direct-analysis-presentation";

export function DirectAnalysisResult({
  result,
  content,
  recordingUrl,
}: {
  result: DirectResult;
  content: AnalysisViewContent;
  recordingUrl?: string;
}) {
  return (
    <AnalysisView
      analysis={directAnalysisPresentation(result)}
      // The direct contract has no sentence scores or sentence judgments.
      segments={[]}
      content={content}
      recordingUrl={recordingUrl}
      reportParameter={`directReport-${result.sourceIdentity.executionId}`}
    />
  );
}
