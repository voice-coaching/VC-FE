import type { AnalysisResult, AnalysisSegment } from "@/lib/api";

// Frame 5 fallback for the custom-script flow, which has no server API.
// These values are examples, never saved as a user's training result.
export function sampleAnalysis(script: string): {
  analysis: AnalysisResult;
  segments: AnalysisSegment[];
} {
  return {
    analysis: {
      id: "local-example",
      status: "COMPLETED",
      transcript: script,
      sttConfidence: 0.94,
      overallScore: 84,
      pronunciationScore: 86,
      intonationScore: 82,
      speedWpm: 130,
      speedStatus: "NORMAL",
      stressScore: 83,
      pauseScore: 88,
      strengths: ["문장의 흐름을 자연스럽게 이어갔어요."],
      weaknesses: ["문장 끝까지 또렷하게 읽는 연습을 해보세요."],
      summaryFeedback:
        "예시 결과예요. 발음과 억양의 피드백을 이렇게 확인할 수 있어요.",
      analyzedAt: new Date().toISOString(),
    },
    segments: Array.from(script.replace(/\s/g, ""))
      .slice(0, 120)
      .map((text, index) => ({
        id: `example-${index}`,
        sequenceNo: index + 1,
        expectedText: text,
        recognizedText: text,
        startMs: index * 250,
        endMs: (index + 1) * 250,
        matchType: "MATCH",
        resultStatus: index === 0 ? "CAUTION" : "NORMAL",
        targetUnit: text,
        errorType: index === 0 ? "예시" : "",
        pronunciationScore: index === 0 ? 72 : 90,
        intonationScore: 82,
        feedback:
          "예시 피드백: 음절을 천천히 나누어 읽고 자연스럽게 이어보세요.",
      })),
  };
}
