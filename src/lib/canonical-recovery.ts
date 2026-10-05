import { ApiError } from "./api/client";
import { CanonicalResultUnavailable } from "./canonical-presentation";

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
