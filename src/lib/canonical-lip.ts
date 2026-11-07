import { z } from "zod";
const count = z.number().int().nonnegative().max(2048);
const index = z.number().int().nonnegative().max(100000);
const score = z.number().finite().min(0).max(100).nullable();
const time = z.number().finite().min(0).max(120).nullable();
const pts = z.number().finite().min(-86400).max(86400).nullable();
const reason = z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/);
const reasons = z.array(reason).max(32);
// Shared lip-provisional-score-v1 contract. These are server-owned evidence values.
const subScore = z
  .object({
    criterionId: z.enum([
      "lip_aperture",
      "lip_rounding",
      "lip_closure",
      "lip_timing",
    ]),
    label: z.string(),
    score,
    status: z.enum(["SCORED", "UNSCORABLE", "NOT_APPLICABLE"]),
    reasonCode: z.string(),
    measurements: z
      .array(
        z
          .object({
            metricId: z.string(),
            value: z.number().finite(),
            referenceMedian: z.number().finite(),
            referenceScale: z.number().finite().positive(),
            referenceCount: z.number().int().min(1).max(32),
            tolerance: z.number().finite().nonnegative(),
            unit: z.enum(["PHONE_PHASE", "FACE_SCALE_NORMALIZED"]),
          })
          .strict(),
      )
      .max(1)
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.status === "SCORED" ? value.score !== null : value.score === null,
    { message: "Invalid visual component score status" },
  );
const observation = z
  .object({
    observationId: z
      .string()
      .regex(/^[0-9a-f]{64}:phone-[0-9]+:LIP_(APERTURE|WIDTH|AREA)_RANGE$/),
    code: z.enum(["LIP_APERTURE_RANGE", "LIP_WIDTH_RANGE", "LIP_AREA_RANGE"]),
    minimum: z.number().finite().min(0).max(100),
    maximum: z.number().finite().min(0).max(100),
    unit: z.literal("FACE_SCALE_NORMALIZED"),
  })
  .strict()
  .refine((v) => v.minimum <= v.maximum);
const phone = z
  .object({
    expectedIndex: index,
    expectedPhone: z.string().min(1).max(20),
    role: z.enum(["onset", "nucleus", "coda"]),
    status: z.enum(["OBSERVED", "REFERENCE_ONLY", "SCORED", "UNSCORABLE"]),
    score,
    scoreKind: z.enum([
      "NONE",
      "REFERENCE_SIMILARITY",
      "CALIBRATED",
      "PROVISIONAL",
    ]),
    referenceDistance: z.number().finite().nonnegative().nullable(),
    referenceIds: z.array(z.string().min(1).max(200)).max(32),
    calibrationRevision: z.string().min(1).max(200).nullable(),
    audioStartSeconds: time,
    audioEndSeconds: time,
    videoStartSeconds: pts,
    videoEndSeconds: pts,
    frameCount: z.number().int().min(0).max(3600),
    reasonCodes: reasons,
    observations: z.array(observation).max(3),
    allowedActionIds: z.array(z.literal("COMPARE_REFERENCE")).max(1),
    subScores: z.array(subScore).max(4).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    const valid =
      (v.scoreKind === "NONE" ? v.score === null : v.score !== null) &&
      (v.status !== "SCORED" ||
        (v.scoreKind === "CALIBRATED" && v.calibrationRevision !== null) ||
        v.scoreKind === "PROVISIONAL") &&
      (v.status !== "REFERENCE_ONLY" ||
        v.scoreKind === "NONE" ||
        v.scoreKind === "REFERENCE_SIMILARITY") &&
      (v.audioStartSeconds === null
        ? v.audioEndSeconds === null
        : v.audioEndSeconds !== null &&
          v.audioStartSeconds < v.audioEndSeconds) &&
      (v.videoStartSeconds === null
        ? v.videoEndSeconds === null
        : v.videoEndSeconds !== null &&
          v.videoStartSeconds < v.videoEndSeconds) &&
      v.observations.every((o) =>
        o.observationId.includes(`:phone-${v.expectedIndex}:`),
      );
    if (!valid)
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid visual evidence",
      });
  });
export const lipVisualSchema = z
  .object({
    status: z.enum([
      "NOT_PROVIDED",
      "OBSERVED",
      "REFERENCE_ONLY",
      "SCORED",
      "UNSCORABLE",
      "FAILED",
      "TIMEOUT",
    ]),
    correctiveClaimsAllowed: z.literal(false),
    score,
    scoreKind: z.enum(["NONE", "CALIBRATED", "PROVISIONAL"]),
    coverage: z
      .object({
        targetCount: count,
        visuallyEligibleCount: count,
        observedCount: count,
        scoredCount: count,
        coverage: z.number().finite().min(0).max(1).nullable(),
      })
      .strict(),
    subScores: z.array(subScore).max(4).optional(),
    phoneAssessments: z.array(phone).max(128),
    omittedPhoneAssessmentCount: count,
    reasonCodes: reasons,
    alignmentScope: z.literal("CANONICAL_MFA_DETECTOR_PHONES_V1"),
    unresolvedExpectedIndices: z.array(index).max(2048),
  })
  .strict()
  .superRefine((v, c) => {
    const n = v.coverage;
    if (
      (v.scoreKind === "NONE" ? v.score !== null : v.score === null) ||
      (v.status === "SCORED" &&
        v.scoreKind !== "CALIBRATED" &&
        v.scoreKind !== "PROVISIONAL") ||
      n.scoredCount > n.observedCount ||
      n.observedCount > n.visuallyEligibleCount ||
      n.visuallyEligibleCount > n.targetCount ||
      v.phoneAssessments.length +
        v.omittedPhoneAssessmentCount +
        v.unresolvedExpectedIndices.length !==
        n.targetCount ||
      new Set(v.unresolvedExpectedIndices).size !==
        v.unresolvedExpectedIndices.length ||
      v.phoneAssessments.some((p) =>
        v.unresolvedExpectedIndices.includes(p.expectedIndex),
      ) ||
      new Set(v.phoneAssessments.map((p) => p.expectedIndex)).size !==
        v.phoneAssessments.length
    )
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid visual summary",
      });
  });
export type LipVisual = z.infer<typeof lipVisualSchema>;
