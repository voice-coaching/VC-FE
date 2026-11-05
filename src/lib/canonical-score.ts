import { z } from "zod";

export const scoreCriteria = [
  ["vowels", "모음", 25],
  ["plain_stops", "평음 파열음", 10],
  ["tense_stops", "경음 파열음", 10],
  ["aspirated_stops", "격음 파열음", 10],
  ["fricatives", "마찰음", 10],
  ["affricates", "파찰음", 10],
  ["nasals", "비음", 10],
  ["liquid", "유음", 5],
  ["coverage", "기대 음소 대응 범위", 10],
] as const;

const computedScore = z
  .object({
    overallScore: z.number().finite().min(0).max(100),
    validity: z.literal("RUBRIC_COMPUTED"),
    reason: z.literal("EVIDENCE_BOUND_PRACTICE_SCORE"),
    // AI owns grading. Historical details never gate the overall score.
    rubricRevision: z.unknown().optional(),
    criteria: z.unknown().optional(),
  })
  .strict();

export const canonicalScoreSchema = z.union([
  computedScore,
  z
    .object({
      overallScore: z.null(),
      validity: z.enum([
        "INSUFFICIENT_EVIDENCE",
        "NOT_CALIBRATED",
        "NOT_AVAILABLE",
      ]),
      reason: z.literal("NO_APPROVED_SCORING_CONTRACT"),
    })
    .strict(),
  z
    .object({
      overallScore: z.null(),
      validity: z.literal("UNSCORABLE"),
      reason: z.literal("SCORING_FAILED"),
    })
    .strict(),
  z
    .object({
      overallScore: z.null(),
      validity: z.literal("NOT_AVAILABLE"),
      reason: z.literal("INPUT_NOT_ACCEPTED"),
    })
    .strict(),
  z
    .object({
      overallScore: z.null(),
      validity: z.literal("NOT_AVAILABLE"),
      reason: z.literal("RESULT_NOT_DELIVERED"),
    })
    .strict(),
]);

export type CanonicalCriterionPoints = {
  criterionId: string;
  label: string;
  points: number | null;
  maxPoints: number;
};

/** Optional historical detail presentation; never a result-acceptance gate.
 * Unknown/missing details leave the AI's overallScore available unchanged.
 * No worksheet reconstruction, revision approval or total recalculation occurs.
 */
export function canonicalCriterionPoints(
  score: z.infer<typeof canonicalScoreSchema>,
): CanonicalCriterionPoints[] {
  if (score.validity !== "RUBRIC_COMPUTED" || !Array.isArray(score.criteria))
    return [];

  return score.criteria.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const definition = scoreCriteria.find(([id]) => id === row.criterionId);
    if (!definition) return [];
    const level = row.level;
    if (
      level !== null &&
      (typeof level !== "number" ||
        !Number.isInteger(level) ||
        level < 0 ||
        level > 4)
    )
      return [];
    const [criterionId, label, maxPoints] = definition;
    return [
      {
        criterionId,
        label,
        // Quarter-point units are exact; null is excluded, while level 0 is 0 points.
        points: level === null ? null : (maxPoints * level) / 4,
        maxPoints,
      },
    ];
  });
}
