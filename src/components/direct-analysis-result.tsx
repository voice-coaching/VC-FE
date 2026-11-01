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
  sentenceMode = false,
}: {
  result: DirectResult;
  content: AnalysisViewContent;
  recordingUrl?: string;
  sentenceMode?: boolean;
}) {
  return (
    <AnalysisView
      analysis={directAnalysisPresentation(result)}
      practiceResult={result.practiceResult}
      practiceDecisionStatus={result.decision.status}
      sentenceMode={sentenceMode}
      corrections={
        !result.failure && result.decision.status === "ACCEPT"
          ? result.coaching.items
          : []
      }
      // Sentence grades are unavailable; the report uses the utterance result.
      segments={[]}
      content={content}
      recordingUrl={recordingUrl}
      reportParameter={`directReport-${result.sourceIdentity.executionId}`}
    />
  );
}
