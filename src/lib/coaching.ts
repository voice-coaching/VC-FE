export interface CoachingItem {
  candidateId: string;
  guidanceId: string;
  evidenceIds: string[];
  expectedPhone: string;
  observedCandidate: string | null;
  observation: string;
  explanation: string;
  action: string;
  practice: string;
  selfCheck: string;
  claimScope: "MODEL_OBSERVATION_NOT_CONFIRMED_ARTICULATION";
  location: {
    word: string | null;
    syllable: string | null;
    charStart: number | null;
    charEnd: number | null;
    writtenRole: "onset" | "nucleus" | "coda" | null;
    roleSemantics: string;
    startMs: number | null;
    endMs: number | null;
    timingProvenance: "CTC_NONBLANK_SPAN" | "UNAVAILABLE";
  };
}

export interface AnalysisCoaching {
  schemaVersion: string;
  status: "READY" | "LIMITED_EVIDENCE" | "NO_ACTIONABLE_ISSUE";
  summary: string;
  strengths: string[];
  items: CoachingItem[];
  practicePlan: string | null;
  limitations: string[];
  comparison: null;
  coverage: {
    expectedPhoneCount: number;
    actionableCandidateCount: number;
    reviewOnlyPhoneCount: number;
    includedCandidateIds: string[];
    omittedCandidateIds: string[];
  };
  score: {
    validity: "INSUFFICIENT_EVIDENCE" | "NOT_CALIBRATED";
    overallScore: null;
    reasonCodes: string[];
  };
  visual: {
    status: string;
    observations: Array<{
      expectedIndex: number;
      stage: string;
      reasonCodes: string[];
      decodedSampleTimesMs: number[];
      samplingScope: string;
      measurements: Array<{
        cueId: string;
        value: number;
        unit: string;
        startMs: number;
        endMs: number;
        sampleCount: null;
        samplingProvenance: string;
      }>;
    }>;
    referenceStatus: "NOT_VALIDATED";
    correctiveClaimsAllowed: false;
  };
  generation: {
    source: "LLM" | "TEMPLATE";
    provider: string;
    promptRevision: string;
    policyRevision: string;
    fallbackReason: string | null;
  };
}

export function supportedCoaching(value: AnalysisCoaching | null | undefined) {
  return value?.schemaVersion === "voice-coaching.coaching-result.v1" &&
    typeof value.summary === "string" &&
    (value.practicePlan === null || typeof value.practicePlan === "string") &&
    Array.isArray(value.items) &&
    value.items.length <= 3 &&
    value.items.every(
      (item) =>
        item &&
        [
          item.candidateId,
          item.guidanceId,
          item.expectedPhone,
          item.observation,
          item.explanation,
          item.action,
          item.practice,
          item.selfCheck,
        ].every((text) => typeof text === "string" && text.length > 0) &&
        Array.isArray(item.evidenceIds) &&
        item.evidenceIds.every((id) => typeof id === "string") &&
        item.claimScope === "MODEL_OBSERVATION_NOT_CONFIRMED_ARTICULATION" &&
        item.location &&
        [item.location.word, item.location.syllable].every(
          (text) => text === null || typeof text === "string",
        ) &&
        [null, "onset", "nucleus", "coda"].includes(
          item.location.writtenRole,
        ) &&
        [
          item.location.charStart,
          item.location.charEnd,
          item.location.startMs,
          item.location.endMs,
        ].every(
          (number) =>
            number === null || (Number.isSafeInteger(number) && number >= 0),
        ) &&
        ["CTC_NONBLANK_SPAN", "UNAVAILABLE"].includes(
          item.location.timingProvenance,
        ),
    ) &&
    new Set(value.items.map((item) => item.candidateId)).size ===
      value.items.length &&
    Array.isArray(value.limitations) &&
    value.limitations.every((text) => typeof text === "string") &&
    Array.isArray(value.strengths) &&
    value.strengths.every((text) => typeof text === "string") &&
    Array.isArray(value.visual?.observations) &&
    value.visual.correctiveClaimsAllowed === false &&
    value.visual.observations.every(
      (observation) =>
        observation &&
        Array.isArray(observation.measurements) &&
        observation.measurements.every(
          (measurement) =>
            measurement &&
            typeof measurement.cueId === "string" &&
            [measurement.value, measurement.startMs, measurement.endMs].every(
              (number) => typeof number === "number" && Number.isFinite(number),
            ),
        ),
    ) &&
    value.score?.overallScore === null &&
    ["INSUFFICIENT_EVIDENCE", "NOT_CALIBRATED"].includes(
      value.score.validity,
    ) &&
    Array.isArray(value.score.reasonCodes) &&
    value.score.reasonCodes.every((code) => typeof code === "string") &&
    ["READY", "LIMITED_EVIDENCE", "NO_ACTIONABLE_ISSUE"].includes(
      value.status,
    ) &&
    ["LLM", "TEMPLATE"].includes(value.generation?.source)
    ? value
    : null;
}

const visualLabels: Record<string, string> = {
  lip_aperture_ratio: "입술 벌림 비율",
  inner_aperture_ratio: "안쪽 입술 벌림 비율",
  outer_aperture_ratio: "바깥쪽 입술 벌림 비율",
  inner_area_ratio: "안쪽 입술 면적 비율",
  outer_area_ratio: "바깥쪽 입술 면적 비율",
  lip_width_ratio: "입술 너비 비율",
};

export function visualMeasurementLabel(cueId: string) {
  return visualLabels[cueId] ?? "추가 입술 관측";
}

export function coachingSeekTime(item: CoachingItem): number | null {
  const { startMs, endMs, timingProvenance } = item.location;
  return timingProvenance === "CTC_NONBLANK_SPAN" &&
    startMs !== null &&
    endMs !== null &&
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    startMs >= 0 &&
    endMs > startMs
    ? startMs / 1000
    : null;
}
