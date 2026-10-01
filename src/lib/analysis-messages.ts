export const ANALYSIS_MESSAGES = [
  "녹음한 발음을 살펴보고 있어요",
  "말소리를 꼼꼼히 듣고 있어요",
  "문장 속 발음 특징을 찾고 있어요",
  "발음과 억양을 살펴보고 있어요",
  "나에게 맞는 피드백을 준비하고 있어요",
] as const;

export const ANALYSIS_MESSAGE_INTERVAL_MS = 4_000;

// Pick uniformly from every message except the one currently displayed.
export function nextAnalysisMessageIndex(
  current: number,
  random = Math.random(),
) {
  const candidate = Math.floor(random * (ANALYSIS_MESSAGES.length - 1));
  return candidate >= current ? candidate + 1 : candidate;
}
