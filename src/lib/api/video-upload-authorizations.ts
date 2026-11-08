import { z } from "zod";
import { ApiError, createHttpClient } from "./client";
import type { Id } from "./types";

export const VIDEO_CONSENT_REVISION = "voice-video-processing-consent-v1";
export const BROWSER_VIDEO_JOBS_PATH = "/browser/v1/video-analysis-jobs";
export const videoSourceSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(256 * 1024 * 1024),
  mimeType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
});
const metadataSchema = z.object({
  clientRequestId: z.string().uuid(),
  scriptText: z.string().min(1).max(8000),
  contentId: z.number().int().positive().safe().nullable(),
  source: videoSourceSchema,
});
const grantSchema = z.object({
  schemaVersion: z.literal("voice-coaching.browser-video-grant.v1"),
  aiBaseUrl: z.string().url(),
  jobsPath: z.literal(BROWSER_VIDEO_JOBS_PATH),
  grantToken: z.string().min(1).max(16384),
  expiresAt: z.number().int().positive(),
  metadata: metadataSchema,
});
export type BrowserVideoSource = z.infer<typeof videoSourceSchema>;
export type VideoUploadAuthorization = z.infer<typeof grantSchema>;
const backend = createHttpClient("/api/backend");

/** Production #212 contract: send source metadata/consent, never video bytes, to Backend. */
export async function requestVideoUploadAuthorization(
  sessionId: Id,
  clientRequestId: string,
  source: BrowserVideoSource,
  signal: AbortSignal,
): Promise<VideoUploadAuthorization> {
  if (!/^[1-9][0-9]*$/.test(String(sessionId))) throw invalidGrant();
  const raw = await backend.request<unknown>(
    `/api/training-sessions/${sessionId}/video-analysis-upload-grants`,
    {
      method: "POST",
      body: {
        clientRequestId,
        source: videoSourceSchema.parse(source),
        videoProcessingConsentAccepted: true,
        videoProcessingConsentPolicyRevision: VIDEO_CONSENT_REVISION,
      },
      cache: "no-store",
      signal,
      endpointErrorsOnly: true,
    },
  );
  const parsed = grantSchema.safeParse(raw);
  if (!parsed.success) throw invalidGrant();
  const grant = parsed.data;
  const original = grant.metadata.source;
  if (
    grant.metadata.clientRequestId !== clientRequestId ||
    original.sha256 !== source.sha256 ||
    original.fileSizeBytes !== source.fileSizeBytes ||
    original.mimeType !== source.mimeType
  )
    throw invalidGrant();
  const origin = new URL(grant.aiBaseUrl);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw invalidGrant();
  return { ...grant, aiBaseUrl: origin.origin };
}
function invalidGrant(): ApiError {
  return new ApiError(
    "영상 업로드 권한의 시도·원본 정보를 확인하지 못했습니다.",
    503,
    "VIDEO_UPLOAD_AUTHORIZATION_INVALID",
  );
}
