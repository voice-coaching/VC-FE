import type { AnalysisScoreGroup } from "@/lib/api";

/**
 * Non-scoring hierarchy groups contain the supplementary video observations.
 * They belong only to feedback produced from the explicit camera practice flow.
 */
export function visibleAnalysisScoreGroups(
  groups: AnalysisScoreGroup[],
  isCameraPractice: boolean,
): AnalysisScoreGroup[] {
  return isCameraPractice
    ? groups
    : groups.filter((group) => group.maxScore !== null);
}
