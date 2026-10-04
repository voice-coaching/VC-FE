import { z } from "zod";
import {
  CANONICAL_PROFILE,
  HANDOFF_PROFILE,
  CanonicalProjectionError,
} from "../canonical-analysis";
import { ApiError, createHttpClient } from "./client";
import type {
  AnalysisRequest,
  AnalysisConsentInput,
  Id,
  AnalysisProgress,
} from "./types";
import {
  readCanonicalAnalysisView,
  type CanonicalViewExpectation,
} from "../canonical-analysis";

export const CANONICAL_RESULT_HEADER =
  "voice-coaching.runpod-analysis-result.v4";
export const HANDOFF_RESULT_HEADER = "voice-coaching.runpod-analysis-result.v5";
const routingSchema = z
  .object({
    analysisId: z.number().int().positive().safe(),
    recordingId: z.number().int().positive().safe(),
    requestId: z.string().uuid(),
    executionId: z.string().uuid(),
    analysisProfile: z.enum([CANONICAL_PROFILE, HANDOFF_PROFILE]),
    resultSchemaVersion: z.enum([
      CANONICAL_RESULT_HEADER,
      HANDOFF_RESULT_HEADER,
    ]),
  })
  .strict();
const capabilitySchema = z
  .object({
    resultSchemas: z
      .array(z.enum([CANONICAL_RESULT_HEADER, HANDOFF_RESULT_HEADER]))
      .max(2),
  })
  .strict();
export function canonicalDatabaseId(value: Id): number {
  if (typeof value === "string" && !/^[1-9][0-9]*$/.test(value))
    throw new ApiError(
      "분석 식별자가 올바르지 않습니다.",
      400,
      "INVALID_ANALYSIS_ID",
    );
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new ApiError(
      "분석 식별자가 올바르지 않습니다.",
      400,
      "INVALID_ANALYSIS_ID",
    );
  return id;
}

/** Sole analysis transport. No legacy request/result fallback. */
export function createCanonicalAnalysisClient(baseUrl: string) {
  const { request } = createHttpClient(baseUrl);

  async function get(expected: CanonicalViewExpectation, signal?: AbortSignal) {
    if (
      !Number.isSafeInteger(expected.analysisId) ||
      expected.analysisId <= 0
    ) {
      throw new ApiError(
        "분석 식별자가 올바르지 않습니다.",
        400,
        "INVALID_ANALYSIS_ID",
      );
    }
    let version = "v2";
    let binding: z.infer<typeof routingSchema> | undefined;
    try {
      const route = await request<unknown>(
        `/api/analyses/${expected.analysisId}/result-contract`,
        {
          method: "GET",
          cache: "no-store",
          signal,
          endpointErrorsOnly: true,
        },
      );
      const parsed = routingSchema.safeParse(route);
      if (!parsed.success) throw new CanonicalProjectionError();
      binding = parsed.data;
      if (
        binding.analysisId !== expected.analysisId ||
        (binding.analysisProfile === HANDOFF_PROFILE) !==
          (binding.resultSchemaVersion === HANDOFF_RESULT_HEADER)
      )
        throw new CanonicalProjectionError();
      for (const key of ["recordingId", "requestId", "executionId"] as const)
        if (expected[key] !== undefined && expected[key] !== binding[key])
          throw new CanonicalProjectionError();
      version =
        binding.resultSchemaVersion === HANDOFF_RESULT_HEADER ? "v3" : "v2";
    } catch (error) {
      // Older Backend has no routing endpoint; only its explicit 404 uses the old v4 route.
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
    const data = await request<unknown>(
      `/api/${version}/analyses/${expected.analysisId}`,
      {
        method: "GET",
        cache: "no-store",
        signal,
        endpointErrorsOnly: true,
      },
    );
    const view = readCanonicalAnalysisView(
      data,
      binding
        ? {
            analysisId: binding.analysisId,
            recordingId: binding.recordingId,
            requestId: binding.requestId,
            executionId: binding.executionId,
          }
        : expected,
    );
    if (
      view.analysisProfile !==
      (version === "v3" ? HANDOFF_PROFILE : CANONICAL_PROFILE)
    )
      throw new CanonicalProjectionError();
    return view;
  }

  async function submit(
    sessionId: Id,
    consent: AnalysisConsentInput,
    retry: boolean,
    signal?: AbortSignal,
  ) {
    let schema: string = CANONICAL_RESULT_HEADER;
    try {
      const caps = capabilitySchema.safeParse(
        await request<unknown>("/api/analysis-capabilities/canonical", {
          method: "GET",
          cache: "no-store",
          signal,
          endpointErrorsOnly: true,
        }),
      );
      if (!caps.success) throw new CanonicalProjectionError();
      if (caps.data.resultSchemas.includes(HANDOFF_RESULT_HEADER))
        schema = HANDOFF_RESULT_HEADER;
      else if (!caps.data.resultSchemas.includes(CANONICAL_RESULT_HEADER))
        throw new ApiError(
          "현재 분석을 접수할 수 없습니다. 잠시 후 다시 시도해 주세요.",
          503,
          "ANALYSIS_INTEGRATION_UNAVAILABLE",
        );
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
    return request<AnalysisRequest>(
      `/api/training-sessions/${canonicalDatabaseId(sessionId)}/${retry ? "analysis/retry" : "analyze"}`,
      {
        method: "POST",
        body: consent,
        signal,
        cache: "no-store",
        endpointErrorsOnly: true,
        headers: { "X-Analysis-Result-Schema": schema },
      },
    );
  }
  function status(sessionId: Id, signal?: AbortSignal) {
    return request<AnalysisProgress>(
      `/api/training-sessions/${canonicalDatabaseId(sessionId)}/analysis/status`,
      {
        signal,
        cache: "no-store",
        endpointErrorsOnly: true,
      },
    );
  }
  return {
    get,
    status,
    analyze: (
      sessionId: Id,
      consent: AnalysisConsentInput,
      signal?: AbortSignal,
    ) => submit(sessionId, consent, false, signal),
    retry: (
      sessionId: Id,
      consent: AnalysisConsentInput,
      signal?: AbortSignal,
    ) => submit(sessionId, consent, true, signal),
  };
}

export const canonicalApi = createCanonicalAnalysisClient("/api/backend");
