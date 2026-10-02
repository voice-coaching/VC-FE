import { ApiError, createHttpClient, getAuthSessionVersion } from "./client";
import type {
  AnalysisResult,
  AnalysisRequest,
  AnalysisConsentInput,
  Id,
  AnalysisProgress,
} from "./types";
import {
  readCanonicalAnalysisView,
  type CanonicalAnalysisView,
  type CanonicalViewExpectation,
} from "../canonical-analysis";

export type CanonicalOrLegacyAnalysis =
  | { kind: "canonical"; analysis: CanonicalAnalysisView }
  | { kind: "legacy"; analysis: AnalysisResult };

export function isLegacyAnalysis(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.code === "CANONICAL_ANALYSIS_NOT_FOUND"
  );
}

export const CANONICAL_RESULT_HEADER =
  "voice-coaching.runpod-analysis-result.v4";
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

/** Separate opt-in client: never changes global headers or legacy method signatures. */
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
    const data = await request<unknown>(
      `/api/v2/analyses/${expected.analysisId}`,
      {
        method: "GET",
        cache: "no-store",
        signal,
        endpointErrorsOnly: true,
      },
    );
    return readCanonicalAnalysisView(data, expected);
  }

  async function getWithLegacyFallback(
    expected: CanonicalViewExpectation,
    signal?: AbortSignal,
  ): Promise<CanonicalOrLegacyAnalysis> {
    const sessionVersion = getAuthSessionVersion();
    try {
      return { kind: "canonical", analysis: await get(expected, signal) };
    } catch (error) {
      if (!isLegacyAnalysis(error)) throw error;
    }
    if (signal?.aborted) {
      throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
    }
    if (sessionVersion !== getAuthSessionVersion()) {
      throw new ApiError(
        "로그인 상태가 변경되었습니다.",
        409,
        "AUTH_SESSION_CHANGED",
      );
    }
    return {
      kind: "legacy",
      analysis: await request<AnalysisResult>(
        `/api/analyses/${expected.analysisId}`,
        {
          method: "GET",
          cache: "no-store",
          signal,
          endpointErrorsOnly: true,
        },
      ),
    };
  }

  function submit(
    sessionId: Id,
    consent: AnalysisConsentInput,
    retry: boolean,
    signal?: AbortSignal,
  ) {
    return request<AnalysisRequest>(
      `/api/training-sessions/${canonicalDatabaseId(sessionId)}/${retry ? "analysis/retry" : "analyze"}`,
      {
        method: "POST",
        body: consent,
        signal,
        cache: "no-store",
        endpointErrorsOnly: true,
        headers: { "X-Analysis-Result-Schema": CANONICAL_RESULT_HEADER },
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
    getWithLegacyFallback,
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
