import { z } from "zod";
import { ApiError, createHttpClient, getAuthSessionVersion } from "./client";
import { prepareVideoForAnalysis, type LipClip } from "../lip-practice";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const requestSchema = z.object({
  clientRequestId: z.string().uuid(),
  videoSha256: sha256,
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024),
  mimeType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
  scriptSha256: sha256,
});
const grantSchema = z.object({
  tokenType: z.literal("Bearer"),
  uploadToken: z.string().min(1).max(8192),
  aiOrigin: z.string().url(),
  clientRequestId: z.string().uuid(),
  expiresAt: z.string().datetime(),
});

export type VideoUploadAuthorizationRequest = z.infer<typeof requestSchema>;
export type VideoUploadAuthorization = z.infer<typeof grantSchema>;
const backend = createHttpClient("/api/backend");

/** Send hashes/metadata only. Never upload the video, script text or AI service credentials to Backend. */
export async function requestVideoUploadAuthorization(
  input: VideoUploadAuthorizationRequest,
  signal?: AbortSignal,
): Promise<VideoUploadAuthorization> {
  const command = requestSchema.parse(input);
  const raw = await backend.request<unknown>(
    "/api/analysis-authorizations/video",
    {
      method: "POST",
      body: command,
      cache: "no-store",
      signal,
      endpointErrorsOnly: true,
    },
  );
  const parsed = grantSchema.safeParse(raw);
  if (!parsed.success || parsed.data.clientRequestId !== input.clientRequestId)
    throw invalidGrant();
  const origin = new URL(parsed.data.aiOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw invalidGrant();
  return { ...parsed.data, aiOrigin: origin.origin };
}

/** Bind permission to the selected original bytes; normalization and receipt generation belong to AI. */
export async function authorizeOriginalVideo(
  clip: LipClip,
  scriptText: string,
  clientRequestId: string,
  signal: AbortSignal,
): Promise<VideoUploadAuthorization> {
  const epoch = getAuthSessionVersion();
  const requireActive = () => {
    if (signal.aborted || epoch !== getAuthSessionVersion())
      throw new DOMException(
        "영상 업로드 권한 요청을 중단했습니다.",
        "AbortError",
      );
  };
  requireActive();
  if (!clip.hasAudioTrack)
    throw new Error("마이크 음성이 포함된 영상으로 다시 촬영해 주세요.");
  if (!scriptText.trim() || [...scriptText].length > 4000)
    throw new Error("분석할 문장을 확인해 주세요.");
  const original = prepareVideoForAnalysis(clip.blob, [
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ]);
  if (!original.blob.size || original.blob.size > 100 * 1024 * 1024)
    throw new Error("촬영 영상은 비어 있지 않은 100 MiB 이하 파일이어야 해요.");
  const videoBytes = await original.blob.arrayBuffer();
  requireActive();
  const [videoSha256, scriptSha256] = await Promise.all([
    digest(videoBytes),
    digest(new TextEncoder().encode(scriptText)),
  ]);
  requireActive();
  const grant = await requestVideoUploadAuthorization(
    {
      clientRequestId,
      videoSha256,
      fileSizeBytes: original.blob.size,
      mimeType:
        original.mimeType as VideoUploadAuthorizationRequest["mimeType"],
      scriptSha256,
    },
    signal,
  );
  requireActive();
  return grant;
}

async function digest(bytes: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function invalidGrant(): ApiError {
  return new ApiError(
    "AI 영상 업로드 권한을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.",
    503,
    "VIDEO_UPLOAD_AUTHORIZATION_INVALID",
  );
}
