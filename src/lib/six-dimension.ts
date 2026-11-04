import { z } from "zod";

export const sixDimensionIds = [
  "pronunciation_accuracy", "speaking_rate", "articulation_rate", "pauses", "pitch", "intensity",
] as const;
const criterionId = z.enum(sixDimensionIds);
const component = z.object({
  metric: z.string(), value: z.number().finite(), unit: z.string(),
  score: z.number().finite().min(0).max(100), weight: z.number().finite().positive(),
  direction: z.string(), target: z.array(z.number().finite()).length(2).optional(),
  validSampleCount: z.number().int().nonnegative().optional(),
  expectedSampleCount: z.number().int().nonnegative().optional(),
});
export const sixDimensionViewSchema = z.object({
  schemaVersion: z.literal("voice-coaching.six-dimension-view.v1"),
  status: z.enum(["READY", "PARTIAL", "UNSCORABLE"]),
  validationStatus: z.literal("EXPERT_REVIEW_PENDING"),
  policyRevision: z.string().min(1),
  generationStatus: z.enum(["NOT_REQUESTED", "NOT_DISPATCHED", "FAILED", "STRUCTURALLY_VALID"]),
  criteria: z.array(z.object({
    criterionId, label: z.string().min(1), scope: z.string().min(1),
    status: z.enum(["SCORED", "UNSCORABLE"]),
    score: z.number().finite().min(0).max(100).nullable(), components: z.array(component),
  })).length(6),
  selectedCriterionIds: z.array(criterionId).max(3),
  feedback: z.array(z.object({
    criterionId, observation: z.string().min(1).max(240), practice: z.string().min(1).max(400),
  })).max(3),
}).superRefine((value, ctx) => {
  const issue = () => ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SIX_DIMENSION_RESULT_MISMATCH" });
  if (value.criteria.some((c, i) => c.criterionId !== sixDimensionIds[i]
    || (c.status === "SCORED") !== (c.score !== null))) issue();
  const scored = value.criteria.filter(c => c.status === "SCORED");
  const status = scored.length === 6 ? "READY" : scored.length ? "PARTIAL" : "UNSCORABLE";
  if (value.status !== status) issue();
  const selected = [...scored].sort((a, b) => (a.score! - b.score!)
    || sixDimensionIds.indexOf(a.criterionId) - sixDimensionIds.indexOf(b.criterionId)).slice(0, 3);
  if (JSON.stringify(selected.map(c => c.criterionId)) !== JSON.stringify(value.selectedCriterionIds)) issue();
  if (value.generationStatus === "STRUCTURALLY_VALID") {
    if (JSON.stringify(value.feedback.map(f => f.criterionId)) !== JSON.stringify(value.selectedCriterionIds)) issue();
  } else if (value.feedback.length !== 0) issue();
});
export type SixDimensionView = z.infer<typeof sixDimensionViewSchema>;
