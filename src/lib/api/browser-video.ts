import { z } from "zod";
import { candidateSchema } from "../canonical-analysis";
import { canonicalScoreSchema } from "../canonical-score";
import { lipVisualSchema } from "../canonical-lip";
import { ApiError, getAuthSessionVersion } from "./client";
import type { Id } from "./types";
import {
  requestVideoUploadAuthorization,
  type BrowserVideoSource,
  type VideoUploadAuthorization,
} from "./video-upload-authorizations";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const jobSchema = z
  .object({
    schemaVersion: z.literal("voice-coaching.independent-audiovisual.v1"),
    jobId: z.string().uuid(),
    executionId: z.string().uuid(),
    clientRequestId: z.string().uuid(),
    status: z.enum([
      "AWAITING_MEDIA",
      "QUEUED",
      "RUNNING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ]),
    sequence: z.number().int().positive().safe(),
    uploaded: z.array(z.literal("source")).max(1),
    resultAvailable: z.boolean(),
    resultSha256: hash.nullable(),
    failure: z.object({ code: z.string() }).nullable(),
  })
  .refine((job) => !job.resultAvailable || job.resultSha256 !== null);
const resultSchema = z.object({
  schemaVersion: z.literal("voice-coaching.independent-audiovisual-result.v1"),
  jobId: z.string().uuid(),
  executionId: z.string().uuid(),
  clientRequestId: z.string().uuid(),
  status: z.enum(["COMPLETED", "FAILED"]),
  score: canonicalScoreSchema,
  coaching: z.object({
    adapterStatus: z.string(),
    generationStatus: z.string(),
    feedback: z.string().max(4000).nullable().optional(),
    items: z
      .array(
        z.object({
          candidate: candidateSchema,
          expression: z.object({
            explanation: z.string(),
            action: z.string(),
            practice: z.string(),
            selfCheck: z.string(),
          }),
        }),
      )
      .max(3),
  }),
  visual: lipVisualSchema,
  sourceIdentity: z.object({ originalVideoSha256: hash, scriptSha256: hash }),
  failure: z.union([z.string(), z.object({ code: z.string() })]).nullable(),
});
export type BrowserVideoJob = z.infer<typeof jobSchema>;
export type BrowserVideoResult = z.infer<typeof resultSchema>;
export function videoTerminal(job: BrowserVideoJob): boolean {
  return ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status);
}
export async function browserVideoSha256(bytes: BufferSource): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Expiring AI grants stay in memory. AI calls omit cookies and Backend login credentials. */
export class BrowserVideoClient {
  private readonly epoch = getAuthSessionVersion();
  private grant?: VideoUploadAuthorization;
  private identity?: { jobId: string; executionId: string };
  private sequence = 0;
  constructor(
    private readonly binding: {
      sessionId: Id;
      clientRequestId: string;
      source: BrowserVideoSource;
      scriptText: string;
      contentId: Id;
    },
  ) {}
  private async authorize(
    signal: AbortSignal,
    renew = false,
  ): Promise<VideoUploadAuthorization> {
    this.requireActive(signal);
    if (
      !renew &&
      this.grant &&
      this.grant.expiresAt * 1000 > Date.now() + 15000
    )
      return this.grant;
    const grant = await requestVideoUploadAuthorization(
      this.binding.sessionId,
      this.binding.clientRequestId,
      this.binding.source,
      signal,
    );
    this.requireActive(signal);
    if (
      grant.metadata.scriptText !== this.binding.scriptText ||
      String(grant.metadata.contentId) !== String(this.binding.contentId) ||
      (this.grant &&
        (grant.aiBaseUrl !== this.grant.aiBaseUrl ||
          grant.jobsPath !== this.grant.jobsPath))
    )
      throw invalid("VIDEO_GRANT_BINDING_CHANGED");
    this.grant = grant;
    return grant;
  }
  private async exchange(
    path: string,
    method: string,
    signal: AbortSignal,
    body?: BodyInit,
    contentType?: string,
  ): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const grant = await this.authorize(signal, attempt === 1);
      this.requireActive(signal);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${grant.grantToken}`,
      };
      if (contentType) headers["Content-Type"] = contentType;
      let response: Response;
      try {
        response = await fetch(grant.aiBaseUrl + grant.jobsPath + path, {
          method,
          headers,
          body,
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(method === "PUT" ? 125000 : 25000),
          ]),
        });
      } catch {
        if (signal.aborted)
          throw new DOMException(
            "영상 분석 대기를 중단했습니다.",
            "AbortError",
          );
        throw new ApiError(
          "AI 연결이 지연됐어요. 같은 촬영본의 처리 상태를 다시 확인해 주세요.",
          0,
          "AI_VIDEO_IO_UNAVAILABLE",
        );
      }
      if (response.status === 401 && attempt === 0) {
        await response.body?.cancel();
        continue;
      }
      return response;
    }
    throw invalid("VIDEO_GRANT_REFRESH_FAILED");
  }
  private correlate(job: BrowserVideoJob): BrowserVideoJob {
    if (
      job.clientRequestId !== this.binding.clientRequestId ||
      (this.identity &&
        (job.jobId !== this.identity.jobId ||
          job.executionId !== this.identity.executionId)) ||
      job.sequence < this.sequence
    )
      throw invalid("VIDEO_JOB_IDENTITY_MISMATCH");
    this.identity = { jobId: job.jobId, executionId: job.executionId };
    this.sequence = job.sequence;
    return job;
  }
  private requireActive(signal: AbortSignal): void {
    if (signal.aborted || this.epoch !== getAuthSessionVersion())
      throw new DOMException("영상 분석 대기를 중단했습니다.", "AbortError");
  }
  private async job(response: Response): Promise<BrowserVideoJob> {
    await requireOk(response);
    const parsed = jobSchema.safeParse(
      decodeDocument(await boundedBytes(response, 131072)),
    );
    if (!parsed.success) throw invalid("VIDEO_JOB_RESPONSE_INVALID");
    return this.correlate(parsed.data);
  }
  async find(signal: AbortSignal): Promise<BrowserVideoJob | null> {
    const response = await this.exchange(
      `?clientRequestId=${this.binding.clientRequestId}`,
      "GET",
      signal,
    );
    if (response.status === 404 && !this.identity) {
      await response.body?.cancel();
      return null;
    }
    return this.job(response);
  }
  async create(signal: AbortSignal): Promise<BrowserVideoJob> {
    const grant = await this.authorize(signal);
    return this.job(
      await this.exchange(
        "",
        "POST",
        signal,
        JSON.stringify(grant.metadata),
        "application/json",
      ),
    );
  }
  async upload(
    jobId: string,
    source: Blob,
    signal: AbortSignal,
  ): Promise<BrowserVideoJob> {
    return this.job(
      await this.exchange(
        `/${jobId}/source`,
        "PUT",
        signal,
        source,
        this.binding.source.mimeType,
      ),
    );
  }
  async start(jobId: string, signal: AbortSignal): Promise<BrowserVideoJob> {
    return this.job(await this.exchange(`/${jobId}/start`, "POST", signal));
  }
  async status(jobId: string, signal: AbortSignal): Promise<BrowserVideoJob> {
    return this.job(await this.exchange(`/${jobId}`, "GET", signal));
  }
  async cancel(jobId: string, signal: AbortSignal): Promise<BrowserVideoJob> {
    return this.job(await this.exchange(`/${jobId}/cancel`, "POST", signal));
  }
  async result(
    job: BrowserVideoJob,
    signal: AbortSignal,
  ): Promise<BrowserVideoResult> {
    const response = await this.exchange(`/${job.jobId}/result`, "GET", signal);
    await requireOk(response);
    const bytes = await boundedBytes(response, 2 * 1024 * 1024);
    const digest = await browserVideoSha256(bytes);
    if (
      digest !== job.resultSha256 ||
      digest !== response.headers.get("X-Result-SHA256")
    )
      throw invalid("VIDEO_RESULT_DIGEST_MISMATCH");
    const parsed = resultSchema.safeParse(decodeDocument(bytes));
    if (!parsed.success) throw invalid("VIDEO_RESULT_RESPONSE_INVALID");
    const result = parsed.data;
    if (
      result.jobId !== job.jobId ||
      result.executionId !== job.executionId ||
      result.clientRequestId !== this.binding.clientRequestId ||
      result.status !== job.status ||
      result.sourceIdentity.originalVideoSha256 !==
        this.binding.source.sha256 ||
      result.sourceIdentity.scriptSha256 !==
        (await browserVideoSha256(
          new TextEncoder().encode(this.binding.scriptText),
        ))
    )
      throw invalid("VIDEO_RESULT_IDENTITY_MISMATCH");
    return result;
  }
}
async function boundedBytes(
  response: Response,
  maximum: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.body) throw invalid("VIDEO_RESPONSE_EMPTY");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw invalid("VIDEO_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function requireOk(response: Response): Promise<void> {
  if (response.ok) return;
  let code = `AI_VIDEO_HTTP_${response.status}`;
  try {
    const raw = JSON.parse(
      new TextDecoder().decode(await boundedBytes(response, 131072)),
    );
    if (
      typeof raw.reasonCode === "string" &&
      /^[A-Za-z0-9_:.-]{1,100}$/.test(raw.reasonCode)
    )
      code = raw.reasonCode;
  } catch {
    /* Never expose arbitrary upstream diagnostics or tokens. */
  }
  const retry = response.headers.get("Retry-After");
  const seconds =
    retry && /^\d+$/.test(retry) ? Math.min(Number(retry), 60) : 0;
  throw new ApiError(
    response.status === 403
      ? "영상 업로드 권한과 접속 주소를 확인해 주세요."
      : response.status === 401
        ? "영상 업로드 권한을 갱신하지 못했어요. 로그인 상태를 확인해 주세요."
        : response.status === 413
          ? "촬영 영상이 업로드 크기 제한을 초과했어요."
          : response.status === 503
            ? "AI 영상 분석이 잠시 준비 중이에요. 같은 촬영본으로 다시 확인해 주세요."
            : `AI 영상 처리 상태를 확인하지 못했어요 (${response.status}). 같은 촬영본으로 다시 확인해 주세요.`,
    response.status,
    code,
    undefined,
    seconds * 1000,
  );
}
function invalid(code: string): ApiError {
  return new ApiError(
    "현재 촬영본의 영상 분석 응답을 안전하게 확인하지 못했어요.",
    502,
    code,
  );
}

function decodeDocument(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw invalid("VIDEO_RESPONSE_INVALID");
  }
}
