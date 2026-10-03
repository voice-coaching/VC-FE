import { z } from "zod";

export const scoreCriteria = [
  ["vowels", "모음"],
  ["plain_stops", "평음 파열음"],
  ["tense_stops", "경음 파열음"],
  ["aspirated_stops", "격음 파열음"],
  ["fricatives", "마찰음"],
  ["affricates", "파찰음"],
  ["nasals", "비음"],
  ["liquid", "유음"],
  ["coverage", "기대 음소 대응 범위"],
] as const;

const computedScore = z
  .object({
    overallScore: z.number().finite().min(0).max(100),
    validity: z.literal("RUBRIC_COMPUTED"),
    reason: z.literal("EVIDENCE_BOUND_PRACTICE_SCORE"),
    rubricRevision: z.literal("phone-rubric-20261003-v1"),
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
