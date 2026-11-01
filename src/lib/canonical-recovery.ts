import { ApiError } from "./api/client";
import { CanonicalResultUnavailable } from "./canonical-presentation";
import type { Id, TrainingSession } from "./api/types";

/** Known backend admission errors occur before acceptance or roll back the request. */
export function analysisRequestWasRejected(reason: unknown) {
  return (
    reason instanceof ApiError &&
    ([400, 401, 403, 404, 413, 415, 422].includes(reason.status) ||
      (reason.status === 503 &&
        reason.code === "ANALYSIS_INTEGRATION_UNAVAILABLE"))
  );
}

/** A server-confirmed pre-analysis session may resubmit the retained recording. */
export function analysisAdmissionMissing(
  session: TrainingSession,
  analysisId?: Id,
) {
  return (
    analysisId == null &&
    session.analysisAvailable === false &&
    ["RECORDING", "UPLOADING"].includes(session.status)
  );
}

/** The same read raced a status update; this does not authorize a new attempt. */
export function isCanonicalReadConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === "CANONICAL_ANALYSIS_CHANGED"
  );
}

/** Unknown result-read failures retain the submitted recording and analysis. */
export function canRecheckSubmittedAnalysis(error: unknown) {
  if (error instanceof CanonicalResultUnavailable) return false;
  return !(
    error instanceof ApiError &&
    ([401, 403, 404, 499].includes(error.status) ||
      ["AUTH_SESSION_CHANGED", "REQUEST_ABORTED"].includes(error.code))
  );
}
