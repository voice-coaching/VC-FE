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
    rubricRevision: z.enum([
      "phone-rubric-20261003-v1",
      "phone-rubric-native-v1",
    ]),
    criteria: z
      .array(
        z
          .object({
            criterionId: z.string(),
            level: z.number().int().min(0).max(4).nullable(),
          })
          .strict(),
      )
      .length(9)
      .refine((rows) =>
        rows.every((row, i) => row.criterionId === scoreCriteria[i][0]),
      ),
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

/** Display the validated server level in its versioned rubric's point units.
 * Source: intelligentAI phone_rubric.py, phone-rubric-20261003-v1.
 * Never re-grade evidence or replace the server's overallScore.
 */
export function canonicalCriterionPoints(
  score: z.infer<typeof canonicalScoreSchema>,
): CanonicalCriterionPoints[] {
  if (
    score.validity !== "RUBRIC_COMPUTED" ||
    score.rubricRevision !== "phone-rubric-20261003-v1"
  )
    return [];

  return score.criteria.map((row, index) => {
    const [, label, maxPoints] = scoreCriteria[index];
    return {
      criterionId: row.criterionId,
      label,
      // Quarter-point units are exact; null is excluded, while level 0 is 0 points.
      points: row.level == null ? null : (maxPoints * row.level) / 4,
      maxPoints,
    };
  });
}
