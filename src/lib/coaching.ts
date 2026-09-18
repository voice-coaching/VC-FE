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
    Array.isArray(value.items) &&
    Array.isArray(value.limitations) &&
    Array.isArray(value.strengths) &&
    Array.isArray(value.visual?.observations) &&
    value.score?.overallScore === null &&
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
