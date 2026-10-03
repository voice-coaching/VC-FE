import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createRemoteApi } from "../src/lib/api/remote";
import { ApiError } from "../src/lib/api/client";
import type { CanonicalAnalysisView } from "../src/lib/canonical-analysis";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function view(): CanonicalAnalysisView {
  return {
    schemaVersion: "voice-coaching.canonical-analysis-view.v1",
    analysisProfile: "CANONICAL_FROZEN_20260928_V4",
    analysisId: 88,
    recordingId: 55,
    requestId: "00000000-0000-4000-8000-000000000001",
    executionId: "00000000-0000-4000-8000-000000000002",
    jobStatus: "COMPLETED",
    serviceFailure: null,
    actions: {
      canComplete: true,
      canRerecord: true,
      canRetry: false,
      canRegenerate: false,
      unavailableReasonCodes: {
        retry: ["NOT_FAILED"],
        rerecord: [],
        complete: [],
        regenerate: ["UNSUPPORTED"],
      },
    },
    canonicalAnalysis: {
      representation: "INLINE",
      decision: { status: "ACCEPT", reason_code: null, stage: null },
      coreStatus: "ok",
      feedbackDeliveryAllowed: true,
      pronunciationFeedbackSource: "REFINED_P1_ONLY",
      selection: {
        attemptScope: "a".repeat(64),
        candidates: [],
        reviewReasonCounts: {},
        coverage: {
          evaluatedConsonantPositions: 0,
          visiblePositionCount: 0,
          permittedPatternCount: 0,
          includedCandidateIds: [],
          omittedCandidateIds: [],
          selectionPolicy: "repetition_then_first_occurrence_max3",
          omittedReason: null,
          presentationStateCounts: {},
        },
      },
      coaching: {
        schemaVersion: "canonical-llm-expression-result-v1",
        adapterStatus: "NO_PERMITTED_COACHING_CONTENT",
        generationStatus: "NOT_DISPATCHED",
        items: [],
        dispatchAttempts: 0,
      },
      score: {
        overallScore: null,
        validity: "NOT_CALIBRATED",
        reason: "NO_APPROVED_SCORING_CONTRACT",
      },
      visual: { status: "NOT_CONNECTED", correctiveClaimsAllowed: false },
    },
  };
}

function server(current: CanonicalAnalysisView) {
  const mutations: string[] = [];
  globalThis.fetch = async (input, options) => {
    const path = String(input);
    if (options?.method === "POST") mutations.push(path);
    const data = path.endsWith("/analysis/status")
      ? { status: "COMPLETED", analysisId: 88, progressPercent: 100 }
      : path.endsWith("/training-sessions/77")
        ? { id: 77, selectedRecordingId: 55 }
        : path.endsWith("/v2/analyses/88")
          ? current
          : { completed: true };
    return new Response(JSON.stringify({ result: true, data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { api: createRemoteApi("https://qa.example.test"), mutations };
}

test("completion accepts the exact analysis attempt displayed to the user", async () => {
  const expected = view();
  const { api, mutations } = server(expected);
  await api.training.complete(77, 9, expected);
  assert.deepEqual(mutations, [
    "https://qa.example.test/api/training-sessions/77/complete",
  ]);
});

test("completion never posts when the current execution changed", async () => {
  const expected = view();
  const { api, mutations } = server({
    ...expected,
    executionId: "00000000-0000-4000-8000-000000000003",
  });
  await assert.rejects(
    api.training.complete(77, 9, expected),
    (error: unknown) =>
      error instanceof ApiError && error.code === "CANONICAL_ATTEMPT_CHANGED",
  );
  assert.deepEqual(mutations, []);
});

test("analysis presentation rejects a different recording before completion", async () => {
  const { api, mutations } = server({ ...view(), recordingId: 99 });
  await assert.rejects(
    api.analyses.get(88, 55),
    /분석 결과의 형식 또는 현재 시도/,
  );
  assert.deepEqual(mutations, []);
});
