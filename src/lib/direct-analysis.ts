import { z } from "zod";
import { canonicalScoreSchema } from "./canonical-score";
import { candidateSchema } from "./canonical-analysis";
import { createHttpClient } from "./api/client";

export const directAnalysisEnabled =
  process.env.NEXT_PUBLIC_DIRECT_ANALYSIS_ENABLED === "true";
const origin = process.env.NEXT_PUBLIC_DIRECT_ANALYSIS_ORIGIN ?? "";
const expression = z.object({
  explanation: z.string(),
  action: z.string(),
  practice: z.string(),
  selfCheck: z.string(),
});
export const directResultSchema = z.object({
  decision: z.object({
    status: z.string(),
    reason_code: z.string().nullable(),
    stage: z.string().nullable(),
  }),
  score: canonicalScoreSchema,
  coaching: z.object({
    items: z.array(z.object({ candidate: candidateSchema, expression })),
    generationStatus: z.string(),
  }),
  failure: z.string().nullable(),
  sourceIdentity: z.object({
    requestId: z.string().uuid(),
    executionId: z.string().uuid(),
    audioSha256: z.string().regex(/^[a-f0-9]{64}$/),
    scriptSha256: z.string().regex(/^[a-f0-9]{64}$/),
    coreManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    harnessManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
export const directViewSchema = z
  .object({
    schemaVersion: z.literal("voice-coaching.direct-analysis.v1"),
    jobId: z.string().uuid(),
    executionId: z.string().uuid(),
    clientAttemptId: z.string().uuid(),
    status: z.enum([
      "QUEUED",
      "RUNNING",
      "RESULT_READY",
      "FAILED",
      "CANCELLED",
    ]),
    result: directResultSchema.nullable(),
    failure: z.string().nullable(),
    archiveStatus: z.string(),
    historySyncStatus: z.string(),
    sequence: z.number(),
  })
  .refine(
    (view) =>
      !view.result ||
      view.result.sourceIdentity.executionId === view.executionId,
    {
      message: "RESULT_IDENTITY_MISMATCH",
    },
  );
export type DirectView = z.infer<typeof directViewSchema>;
export type DirectResult = z.infer<typeof directResultSchema>;
const backend = createHttpClient("/api/backend");

function endpoint(path: string) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("분석 서버 주소가 설정되지 않았습니다.");
  return url.origin + path;
}
async function response(reply: Response) {
  if (!reply.ok)
    throw new Error(
      `분석 서버 응답 오류 (${reply.status}). 같은 요청으로 다시 확인해 주세요.`,
    );
  return directViewSchema.parse(await reply.json());
}
export async function submitDirect(
  blob: Blob,
  scriptText: string,
  contentId: number | null,
  clientAttemptId: string,
  historyClaim: string,
  signal: AbortSignal,
) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(historyClaim),
  );
  const historyClaimSha256 = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      scriptText,
      contentId,
      clientAttemptId,
      historyClaimSha256,
    }),
  );
  const metadata = btoa(
    Array.from(bytes, (b) => String.fromCharCode(b)).join(""),
  );
  // Deliberately no user Authorization, cookie, RunPod key or AWS proxy.
  return response(
    await fetch(endpoint("/api/v1/analyses"), {
      method: "POST",
      credentials: "omit",
      signal,
      headers: { "Content-Type": "audio/wav", "X-Analysis-Metadata": metadata },
      body: blob,
    }),
  );
}
export async function findDirect(attemptId: string, signal: AbortSignal) {
  return response(
    await fetch(
      endpoint(
        `/api/v1/analyses?clientAttemptId=${encodeURIComponent(attemptId)}`,
      ),
      { credentials: "omit", cache: "no-store", signal },
    ),
  );
}
export async function readDirect(jobId: string, signal: AbortSignal) {
  return response(
    await fetch(endpoint(`/api/v1/analyses/${encodeURIComponent(jobId)}`), {
      credentials: "omit",
      cache: "no-store",
      signal,
    }),
  );
}
export async function observeDirect(
  jobId: string,
  signal: AbortSignal,
  onView: (view: DirectView) => void,
) {
  const terminal = (v: DirectView) => !["QUEUED", "RUNNING"].includes(v.status);
  while (!signal.aborted) {
    try {
      const reply = await fetch(
        endpoint(`/api/v1/analyses/${encodeURIComponent(jobId)}/events`),
        { credentials: "omit", signal },
      );
      if (!reply.ok || !reply.body) throw new Error("STREAM_UNAVAILABLE");
      const reader = reply.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      try {
        while (!signal.aborted) {
          const part = await reader.read();
          if (part.done) break;
          pending += decoder.decode(part.value, { stream: true });
          if (pending.length > 2 * 1024 * 1024)
            throw new Error("RESULT_TOO_LARGE");
          let boundary;
          while ((boundary = pending.indexOf("\n\n")) >= 0) {
            const event = pending.slice(0, boundary);
            pending = pending.slice(boundary + 2);
            const data = event
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!data) continue;
            const view = directViewSchema.parse(JSON.parse(data.slice(6)));
            if (view.jobId !== jobId)
              throw new Error("RESULT_IDENTITY_MISMATCH");
            onView(view);
            if (terminal(view)) return view;
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
    } catch (error) {
      if (signal.aborted) throw error;
    }
    const view = await readDirect(jobId, signal);
    onView(view);
    if (terminal(view)) return view;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new DOMException("Aborted", "AbortError");
}
export async function cancelDirect(jobId: string) {
  return response(
    await fetch(
      endpoint(`/api/v1/analyses/${encodeURIComponent(jobId)}/cancellations`),
      { method: "POST", credentials: "omit" },
    ),
  );
}
export function linkDirectHistory(
  jobId: string,
  historyClaim: string,
  signal?: AbortSignal,
) {
  return backend.request<{ state: string }>(
    `/api/direct-analysis-history/${jobId}/link`,
    { method: "POST", body: { historyClaim }, signal },
  );
}
export async function listDirectHistory(signal: AbortSignal) {
  const data = await backend.request<unknown>("/api/direct-analysis-history", {
    signal,
  });
  return z
    .array(
      z.object({
        jobId: z.string().uuid(),
        scriptText: z.string(),
        result: directResultSchema,
        storageStatus: z.string(),
      }),
    )
    .parse(data);
}
