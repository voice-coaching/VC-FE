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

export const HANDOFF_RESULT_HEADER = "voice-coaching.runpod-analysis-result.v5";
export const AUDIOVISUAL_RESULT_HEADER =
  "voice-coaching.runpod-analysis-result.v6";
export const CANONICAL_RESULT_HEADER = HANDOFF_RESULT_HEADER;
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

  async function get(
    expected: CanonicalViewExpectation,
    signal?: AbortSignal,
    waitSeconds = 0,
  ) {
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
    const data = await request<unknown>(
      `/api/v3/analyses/${expected.analysisId}${waitSeconds ? `?waitSeconds=${waitSeconds}` : ""}`,
      { method: "GET", cache: "no-store", signal, endpointErrorsOnly: true },
    );
    const view = readCanonicalAnalysisView(data, expected);
    return view;
  }

  async function submit(
    sessionId: Id,
    consent: AnalysisConsentInput,
    retry: boolean,
    signal?: AbortSignal,
    audiovisual = false,
  ) {
    return request<AnalysisRequest>(
      `/api/training-sessions/${canonicalDatabaseId(sessionId)}/${retry ? "analysis/retry" : "analyze"}`,
      {
        method: "POST",
        body: consent,
        signal,
        cache: "no-store",
        endpointErrorsOnly: true,
        headers: {
          "X-Analysis-Result-Schema": audiovisual
            ? AUDIOVISUAL_RESULT_HEADER
            : HANDOFF_RESULT_HEADER,
        },
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
    analyzeAudiovisual: (
      sessionId: Id,
      consent: AnalysisConsentInput,
      signal?: AbortSignal,
    ) => submit(sessionId, consent, false, signal, true),
    retryAudiovisual: (
      sessionId: Id,
      consent: AnalysisConsentInput,
      signal?: AbortSignal,
    ) => submit(sessionId, consent, true, signal, true),
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
