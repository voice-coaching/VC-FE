import { z } from "zod";
import { createHttpClient, ApiError } from "./client";
import { canonicalDatabaseId } from "./canonical";
import type { Id, AnalysisProgress } from "./types";

const id = z.number().int().positive().safe();
const analysis = z.object({
  analysisId: id,
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
  stage: z.string().nullable(),
  progressPercent: z.number().min(0).max(100),
  failureReason: z.string().nullable(),
  updatedAt: z.string().nullable(),
  deadlineAt: z.string().nullable(),
  serverTime: z.string(),
  resultAvailable: z.boolean(),
});
const recoverySchema = z.object({
  sessionId: id,
  status: z.string(),
  selectedRecordingId: id.nullable(),
  analysis: analysis.nullable(),
  uploads: z
    .array(
      z.object({
        uploadIntentId: id,
        objectKey: z.string().min(1),
        mimeType: z.string(),
        fileSizeBytes: z.number().positive(),
        status: z.enum([
          "UPLOAD_REQUIRED",
          "READY_TO_REGISTER",
          "REGISTERED",
          "EXPIRED",
          "RECORDING_UNAVAILABLE",
        ]),
        recordingId: id.nullable(),
        expiresAt: z.string(),
      }),
    )
    .max(20),
  hasMoreUploads: z.boolean(),
  serverTime: z.string(),
});
export type TrainingRecovery = Omit<
  z.infer<typeof recoverySchema>,
  "analysis"
> & { analysis: AnalysisProgress | null };
const { request } = createHttpClient("/api/backend");

/** Only a successful authoritative HEAD/recovery response may declare an upload missing. */
export async function loadTrainingRecovery(
  sessionId: Id,
  signal?: AbortSignal,
): Promise<TrainingRecovery> {
  const result = recoverySchema.parse(
    await request<unknown>(
      `/api/training-sessions/${canonicalDatabaseId(sessionId)}/recovery`,
      {
        method: "GET",
        cache: "no-store",
        signal,
        endpointErrorsOnly: true,
      },
    ),
  );
  if (String(result.sessionId) !== String(sessionId))
    throw new ApiError(
      "복구 대상 학습이 변경되었습니다.",
      409,
      "CANONICAL_ATTEMPT_CHANGED",
    );
  return result as TrainingRecovery;
}
