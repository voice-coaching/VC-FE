import { z } from "zod";

export const scoreDetailCriterionIds = [
  "pronunciation_accuracy",
  "speaking_rate",
  "articulation_rate",
  "pauses",
  "pitch",
  "intensity",
] as const;

const percentage = z.number().finite().min(0).max(100);
const criterionFields = {
  criterionId: z.enum(scoreDetailCriterionIds),
  label: z.string().min(1),
  reasonCode: z.string().min(1),
  weight: percentage.int(),
};

/** Display metadata only: no fixed weighting, arithmetic or model-release gate. */
export const publicScoreDetailsSchema = z
  .object({
    schemaVersion: z.literal("voice-coaching.score-details.v1"),
    validationStatus: z.literal("EXPERT_REVIEW_PENDING"),
    aggregationMode: z.enum(["AUDIO_ONLY", "AUDIO_VISUAL"]),
    audioScore: percentage.nullable(),
    visualScore: percentage.nullable(),
    audioWeight: percentage.int(),
    visualWeight: percentage.int(),
    criteria: z
      .array(
        z.discriminatedUnion("status", [
          z.object({
            ...criterionFields,
            status: z.literal("SCORED"),
            score: percentage,
          }),
          z.object({
            ...criterionFields,
            status: z.literal("UNSCORABLE"),
            score: z.null(),
          }),
        ]),
      )
      .length(6),
  })
  .refine(
    (details) =>
      new Set(details.criteria.map((row) => row.criterionId)).size === 6,
  );

export type PublicScoreDetails = z.infer<typeof publicScoreDetailsSchema>;

/** Keep the documented order without interpreting server weights or deriving a total. */
export function scoreDetailRows(
  details: PublicScoreDetails,
): PublicScoreDetails["criteria"] {
  return scoreDetailCriterionIds.flatMap((id) =>
    details.criteria.filter((row) => row.criterionId === id),
  );
}

export function formatPublicScore(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(1)
    : "—";
}

export function unscorableScoreReason(reasonCode: string): string {
  return reasonCode === "F0_INSUFFICIENT_VALID_FRAMES"
    ? "음높이를 평가할 수 있는 구간이 충분하지 않아요."
    : "이번 녹음에서는 이 항목을 평가할 근거가 충분하지 않아요.";
}
