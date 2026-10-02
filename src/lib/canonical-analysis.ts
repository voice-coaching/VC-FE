import { z } from "zod";

// Deployed PUBLIC view allowlist. Safe subtrees follow runpod_result_v4;
// this is never a parser for the private callback or raw core.
export const CANONICAL_VIEW_SCHEMA =
  "voice-coaching.canonical-analysis-view.v1";
export const CANONICAL_PROFILE = "CANONICAL_FROZEN_20260928_V4";

const text = z.string().min(1);
const code = text.max(256).regex(/^[A-Za-z0-9_.:-]+$/);
const index = z.number().int().nonnegative().safe();
const databaseId = z.number().int().positive().safe();
const seconds = z.number().finite().nonnegative();
const scope = z.string().regex(/^[a-f0-9]{64}$/);
const candidateId = z
  .string()
  .regex(/^[a-f0-9]{64}:candidate-(0|[1-9][0-9]*)$/);
const evidenceId = z.string().regex(/^[a-f0-9]{64}:phone-(0|[1-9][0-9]*)$/);
const decisionStatus = z.enum([
  "ACCEPT",
  "REJECT",
  "INCONCLUSIVE",
  "SYSTEM_FAILURE",
]);

const factSchema = z
  .object({
    evidenceId,
    expectedIndex: index,
    location: z
      .object({
        word: text,
        wordIndex: index,
        wordStartS: seconds,
        wordEndS: seconds,
        phoneStartS: seconds,
        phoneEndS: seconds,
        timingProvenance: z.literal("MFA_LOCATION_ONLY"),
      })
      .strict(),
    localizationStatus: text,
  })
  .strict();

const candidateSchema = z
  .object({
    candidateId,
    evidenceIds: z.array(evidenceId),
    expectedPhone: text,
    observedCandidate: text,
    expectedRole: z.enum(["onset", "nucleus", "coda"]),
    roleSemantics: z.literal("FROZEN_G2P_EXPECTED_PHONE_ROLE"),
    repetitionCount: z.number().int().positive().safe(),
    claimScope: z.literal("MODEL_OBSERVATION_NOT_CONFIRMED_ARTICULATION"),
    disposition: z.literal("PRONUNCIATION_REVIEW"),
    presentationState: z.literal("CLEAR_CONTRAST"),
    guidance: z
      .object({
        guidanceId: text,
        revision: z.literal("basic-practice-v1"),
        scope: z.literal("GENERAL_TARGET_PRACTICE_NOT_PERSONAL_CAUSE"),
        action: text,
        practice: text,
        selfCheck: text,
      })
      .strict(),
    facts: z.array(factSchema),
  })
  .strict();

const expressionText = text.max(1200);
const expressionSchema = z
  .object({
    candidateId: candidateId.max(1200),
    guidanceId: expressionText,
    explanation: expressionText,
    action: expressionText,
    practice: expressionText,
    selfCheck: expressionText,
  })
  .strict();

const coverageSchema = z
  .object({
    evaluatedConsonantPositions: index,
    visiblePositionCount: index,
    permittedPatternCount: index,
    includedCandidateIds: z.array(candidateId).max(3),
    omittedCandidateIds: z.array(candidateId),
    selectionPolicy: z.literal("repetition_then_first_occurrence_max3"),
    omittedReason: z.literal("EXISTING_MAX3_SELECTION").nullable(),
    presentationStateCounts: z.record(text, index),
  })
  .strict();

// Omit private coreInputValidation/coreSha256; retain actual branch names,
// candidate/expression nesting, absent fields and literal permissions.
const coachingBase = {
  schemaVersion: z.literal("canonical-llm-expression-result-v1"),
};
const coachingSchema = z.union([
  z
    .object({
      ...coachingBase,
      adapterStatus: z.literal("READY"),
      generationStatus: z.enum([
        "SCHEMA_AND_STRUCTURAL_SEMANTICS_VALID",
        "DETERMINISTIC_FALLBACK",
      ]),
      items: z
        .array(
          z
            .object({
              candidate: candidateSchema,
              expression: expressionSchema,
            })
            .strict(),
        )
        .min(1)
        .max(3),
      dispatchAttempts: z.literal(1),
      fallbackReason: text.max(128).nullable(),
      naturalLanguageSemanticsFullyVerified: z.literal(false),
      visualCorrectiveClaimsAllowed: z.literal(false),
    })
    .strict(),
  z
    .object({
      ...coachingBase,
      adapterStatus: z.enum([
        "GLOBAL_REJECT",
        "GLOBAL_INCONCLUSIVE",
        "GLOBAL_SYSTEM_FAILURE",
        "NO_PERMITTED_COACHING_CONTENT",
      ]),
      generationStatus: z.literal("NOT_DISPATCHED"),
      items: z.array(z.never()).max(0),
      dispatchAttempts: z.literal(0),
    })
    .strict(),
  z
    .object({
      ...coachingBase,
      adapterStatus: z.literal("FAIL_CLOSED"),
      generationStatus: z.literal("NOT_DISPATCHED"),
      items: z.array(z.never()).max(0),
      dispatchAttempts: z.literal(0),
      errorCode: text.max(128),
    })
    .strict(),
]);

const canonicalSchema = z
  .object({
    representation: z.enum(["INLINE", "RETAINED_ONLY"]),
    decision: z
      .object({
        status: decisionStatus,
        // Keep the source name; unfamiliar codes receive generic UI guidance.
        reason_code: code.nullable(),
        stage: code.nullable(),
      })
      .strict(),
    coreStatus: z.enum(["ok", "partial", "error"]),
    feedbackDeliveryAllowed: z.boolean(),
    pronunciationFeedbackSource: z.literal("REFINED_P1_ONLY"),
    selection: z
      .object({
        attemptScope: scope,
        coverage: coverageSchema,
        reviewReasonCounts: z.record(text, index),
        candidates: z.array(candidateSchema).max(3),
      })
      .strict()
      .nullable(),
    coaching: coachingSchema.nullable(),
    score: z
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
    visual: z
      .object({
        status: z.literal("NOT_CONNECTED"),
        correctiveClaimsAllowed: z.literal(false),
      })
      .strict(),
  })
  .strict();

const actionsSchema = z
  .object({
    canRetry: z.boolean(),
    canRerecord: z.boolean(),
    canComplete: z.boolean(),
    canRegenerate: z.literal(false),
    unavailableReasonCodes: z
      .object({
        retry: z.array(code),
        rerecord: z.array(code),
        complete: z.array(code),
        regenerate: z.array(code).min(1),
      })
      .strict(),
  })
  .strict();

const projectionSchema = z
  .object({
    schemaVersion: z.literal(CANONICAL_VIEW_SCHEMA),
    analysisId: databaseId,
    recordingId: databaseId,
    requestId: z.string().uuid(),
    executionId: z.string().uuid(),
    jobStatus: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
    analysisProfile: z.literal(CANONICAL_PROFILE),
    canonicalAnalysis: canonicalSchema.nullable(),
    serviceFailure: z
      .object({ origin: code, code, stage: code })
      .strict()
      .nullable(),
    actions: actionsSchema,
  })
  .strict();

const expectationSchema = z
  .object({
    analysisId: databaseId,
    recordingId: databaseId.optional(),
    requestId: z.string().uuid().optional(),
    executionId: z.string().uuid().optional(),
  })
  .strict();

export type CanonicalAnalysisView = z.infer<typeof projectionSchema>;
export type CanonicalCandidate = z.infer<typeof candidateSchema>;
export type CanonicalDecisionStatus = z.infer<typeof decisionStatus>;
export type CanonicalViewIdentity = Pick<
  CanonicalAnalysisView,
  "analysisId" | "recordingId" | "requestId" | "executionId"
>;
export type CanonicalViewExpectation = Pick<
  CanonicalViewIdentity,
  "analysisId"
> &
  Partial<Omit<CanonicalViewIdentity, "analysisId">>;

export class CanonicalProjectionError extends Error {
  readonly code = "INVALID_CANONICAL_PROJECTION";
  constructor() {
    // Never attach rejected payloads, private diagnostics or raw validation errors.
    super("분석 결과의 형식 또는 현재 시도 정보를 확인할 수 없습니다.");
    this.name = "CanonicalProjectionError";
  }
}
function requireProjection(condition: boolean): asserts condition {
  if (!condition) throw new CanonicalProjectionError();
}
function unique(values: readonly string[]) {
  return new Set(values).size === values.length;
}
function sameOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Reads ApiEnvelope.data; no coercion, sorting, ID shortening or legacy conversion. */
export function readCanonicalAnalysisView(
  input: unknown,
  expected: CanonicalViewExpectation,
): CanonicalAnalysisView {
  requireProjection(expectationSchema.safeParse(expected).success);
  const parsed = projectionSchema.safeParse(input);
  if (!parsed.success) throw new CanonicalProjectionError();
  const view = parsed.data;
  for (const field of [
    "analysisId",
    "recordingId",
    "requestId",
    "executionId",
  ] as const) {
    requireProjection(
      expected[field] === undefined || expected[field] === view[field],
    );
  }
  const { canonicalAnalysis: canonical, actions, jobStatus } = view;
  const pending = jobStatus === "PENDING" || jobStatus === "PROCESSING";
  requireProjection(
    !pending || (canonical === null && view.serviceFailure === null),
  );
  requireProjection(jobStatus !== "COMPLETED" || canonical !== null);
  requireProjection(
    jobStatus === "FAILED"
      ? view.serviceFailure !== null
      : view.serviceFailure === null,
  );
  requireProjection(!actions.canRetry || jobStatus === "FAILED");
  requireProjection(
    !actions.canComplete ||
      (jobStatus === "COMPLETED" &&
        canonical?.decision.status === "ACCEPT" &&
        canonical.representation === "INLINE" &&
        canonical.feedbackDeliveryAllowed),
  );
  for (const [allowed, reasons] of [
    [actions.canRetry, actions.unavailableReasonCodes.retry],
    [actions.canRerecord, actions.unavailableReasonCodes.rerecord],
    [actions.canComplete, actions.unavailableReasonCodes.complete],
    [actions.canRegenerate, actions.unavailableReasonCodes.regenerate],
  ] as const) {
    requireProjection(allowed ? reasons.length === 0 : reasons.length > 0);
  }
  if (!canonical) return view;
  const { decision, selection, coaching } = canonical;
  requireProjection(
    decision.status !== "SYSTEM_FAILURE" || jobStatus === "FAILED",
  );
  if (canonical.representation === "RETAINED_ONLY") {
    requireProjection(
      jobStatus === "FAILED" && selection === null && coaching === null,
    );
  }
  if (decision.status !== "ACCEPT") {
    requireProjection(
      coaching === null ||
        (coaching.dispatchAttempts === 0 && coaching.items.length === 0),
    );
  }
  if (coaching?.adapterStatus === "READY") {
    requireProjection(
      jobStatus === "COMPLETED" &&
        decision.status === "ACCEPT" &&
        selection !== null,
    );
    requireProjection(
      coaching.generationStatus === "DETERMINISTIC_FALLBACK"
        ? coaching.fallbackReason !== null
        : coaching.fallbackReason === null,
    );
  } else if (coaching?.adapterStatus === "NO_PERMITTED_COACHING_CONTENT") {
    requireProjection(
      jobStatus === "COMPLETED" &&
        decision.status === "ACCEPT" &&
        selection !== null &&
        selection.candidates.length === 0,
    );
  } else if (coaching?.adapterStatus === "FAIL_CLOSED") {
    requireProjection(jobStatus === "FAILED" && selection === null);
  } else if (coaching) {
    const expectedStatus = {
      GLOBAL_REJECT: "REJECT",
      GLOBAL_INCONCLUSIVE: "INCONCLUSIVE",
      GLOBAL_SYSTEM_FAILURE: "SYSTEM_FAILURE",
    } as const;
    requireProjection(
      decision.status === expectedStatus[coaching.adapterStatus] &&
        selection === null,
    );
    requireProjection(
      jobStatus ===
        (decision.status === "SYSTEM_FAILURE" ? "FAILED" : "COMPLETED"),
    );
  }
  if (jobStatus === "COMPLETED") {
    requireProjection(
      canonical.representation === "INLINE" && coaching !== null,
    );
    if (decision.status === "ACCEPT") {
      requireProjection(selection !== null);
      requireProjection(
        selection.candidates.length > 0
          ? coaching.adapterStatus === "READY"
          : coaching.adapterStatus === "NO_PERMITTED_COACHING_CONTENT",
      );
    }
  }
  if (selection) {
    const { attemptScope, coverage, candidates } = selection;
    const ids = candidates.map((candidate) => candidate.candidateId);
    requireProjection(sameOrder(ids, coverage.includedCandidateIds));
    requireProjection(unique([...ids, ...coverage.omittedCandidateIds]));
    for (const id of [...ids, ...coverage.omittedCandidateIds]) {
      requireProjection(id.startsWith(attemptScope + ":candidate-"));
      requireProjection(
        Number.isSafeInteger(Number(id.split("candidate-")[1])),
      );
    }
    for (const candidate of candidates) {
      requireProjection(unique(candidate.evidenceIds));
      requireProjection(unique(candidate.facts.map((fact) => fact.evidenceId)));
      // Membership is a set; preserve original evidence/fact order independently.
      requireProjection(
        candidate.evidenceIds.length === candidate.facts.length,
      );
      requireProjection(
        candidate.facts.every((fact) =>
          candidate.evidenceIds.includes(fact.evidenceId),
        ),
      );
      for (const fact of candidate.facts) {
        requireProjection(
          fact.evidenceId === attemptScope + ":phone-" + fact.expectedIndex,
        );
        const { wordStartS, wordEndS, phoneStartS, phoneEndS } = fact.location;
        requireProjection(
          wordStartS <= phoneStartS &&
            phoneStartS <= phoneEndS &&
            phoneEndS <= wordEndS,
        );
      }
    }
    if (coaching?.adapterStatus === "READY") {
      requireProjection(
        sameOrder(
          ids,
          coaching.items.map((item) => item.candidate.candidateId),
        ),
      );
      requireProjection(
        sameOrder(
          ids,
          coaching.items.map((item) => item.expression.candidateId),
        ),
      );
      coaching.items.forEach((item, i) => {
        // Both objects were parsed with the same schema: compare all original
        // safe fields, guidance and ordered facts, not just candidate IDs.
        requireProjection(
          JSON.stringify(item.candidate) === JSON.stringify(candidates[i]),
        );
        requireProjection(
          item.expression.guidanceId === candidates[i].guidance.guidanceId,
        );
      });
    }
  }
  return view;
}

/** Key a future result by full current identity, never analysisId alone. */
export function canonicalAttemptKey(identity: CanonicalViewIdentity): string {
  return JSON.stringify([
    identity.analysisId,
    identity.recordingId,
    identity.requestId,
    identity.executionId,
  ]);
}
export function canonicalCandidateKey(
  identity: CanonicalViewIdentity,
  scopedId: string,
): string {
  return JSON.stringify([canonicalAttemptKey(identity), scopedId]);
}
