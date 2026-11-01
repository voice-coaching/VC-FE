import { z } from "zod";
import { directEndpoint, directViewSchema } from "./direct-analysis";

const sentence = z.object({
  sequenceNo: z.number().int().positive(),
  scriptText: z.string().min(1).max(4000),
  jobId: z.string().uuid().nullable(),
  status: z.enum([
    "AWAITING_UPLOAD",
    "QUEUED",
    "RUNNING",
    "RESULT_READY",
    "FAILED",
    "CANCELLED",
  ]),
});
export const sentenceBatchSchema = z
  .object({
    schemaVersion: z.literal("voice-coaching.direct-practice-batch.v1"),
    batchId: z.string().uuid(),
    status: z.enum(["RECORDING", "PROCESSING", "RESULT_READY", "CANCELLED"]),
    sentenceCount: z.number().int().min(1).max(50),
    uploadedCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    sentences: z.array(sentence).min(1).max(50),
    results: z
      .array(
        z.object({
          sequenceNo: z.number().int().positive(),
          scriptText: z.string(),
          analysis: directViewSchema,
        }),
      )
      .nullable(),
  })
  .superRefine((view, ctx) => {
    const valid =
      view.sentences.length === view.sentenceCount &&
      view.sentences.every((row, i) => row.sequenceNo === i + 1) &&
      view.uploadedCount ===
        view.sentences.filter((row) => row.jobId != null).length &&
      view.completedCount ===
        view.sentences.filter((row) =>
          ["RESULT_READY", "FAILED", "CANCELLED"].includes(row.status),
        ).length &&
      (view.status === "RESULT_READY"
        ? view.completedCount === view.sentenceCount &&
          view.results?.length === view.sentenceCount &&
          view.results.every(
            (row, i) =>
              row.sequenceNo === i + 1 &&
              row.scriptText === view.sentences[i].scriptText &&
              row.analysis.jobId === view.sentences[i].jobId &&
              row.analysis.status === view.sentences[i].status,
          )
        : view.results === null);
    if (!valid)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "BATCH_RESULT_MISMATCH",
      });
  });
export type SentenceBatch = z.infer<typeof sentenceBatchSchema>;

export async function sha256(value: string): Promise<string> {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(raw), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** This public lane deliberately sends neither cookies nor service credentials. */
async function requestSentenceBatch(
  path: string,
  signal: AbortSignal,
  init: RequestInit = {},
  batchId?: string,
): Promise<SentenceBatch> {
  const response = await fetch(
    directEndpoint(`/api/v1/practice-batches${path}`),
    {
      ...init,
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    },
  );
  if (!response.ok) {
    const body = z
      .object({ code: z.string() })
      .safeParse(await response.json().catch(() => null));
    const code = body.success ? body.data.code : "BATCH_REQUEST_FAILED";
    const messages: Record<string, string> = {
      INVALID_PCM_WAV:
        "문장 녹음 형식이나 길이를 확인하지 못했어요. 0.5초 이상 다시 녹음해 주세요.",
      INVALID_BATCH_SENTENCES: "한 연습은 1~50문장, 총 4000자까지 지원해요.",
      BATCH_CANCELLED: "취소한 연습이에요. 새 연습을 시작해 주세요.",
      IDEMPOTENCY_CONFLICT:
        "이미 접수한 문장의 녹음과 달라요. 상태를 다시 확인해 주세요.",
      CAPACITY_EXCEEDED:
        "분석 요청이 많아요. 잠시 후 같은 녹음을 다시 보내 주세요.",
      UPLOAD_CAPACITY_EXCEEDED:
        "녹음 전송이 많아요. 잠시 후 같은 녹음을 다시 보내 주세요.",
    };
    throw new Error(
      messages[code] ??
        "문장 분석 요청을 확인하지 못했어요. 같은 녹음을 다시 보내거나 상태를 확인해 주세요.",
    );
  }
  const view = sentenceBatchSchema.parse(await response.json());
  if (batchId && view.batchId !== batchId)
    throw new Error("BATCH_IDENTITY_MISMATCH");
  for (const row of view.results ?? []) {
    const result = row.analysis.result;
    if (
      result &&
      result.sourceIdentity.scriptSha256 !== (await sha256(row.scriptText))
    ) {
      throw new Error("SENTENCE_SCRIPT_MISMATCH");
    }
  }
  return view;
}

export function createSentenceBatch(
  batchId: string,
  sentences: string[],
  contentId: number | null,
  historyClaimSha256: string,
  signal: AbortSignal,
): Promise<SentenceBatch> {
  return requestSentenceBatch(
    "",
    signal,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientBatchId: batchId,
        sentences,
        contentId,
        historyClaimSha256,
      }),
    },
    batchId,
  );
}
export function readSentenceBatch(
  batchId: string,
  signal: AbortSignal,
  wait = false,
): Promise<SentenceBatch> {
  return requestSentenceBatch(
    `/${encodeURIComponent(batchId)}${wait ? "?waitSeconds=20" : ""}`,
    signal,
    {},
    batchId,
  );
}
export function uploadBatchSentence(
  batchId: string,
  index: number,
  blob: Blob,
  signal: AbortSignal,
): Promise<SentenceBatch> {
  return requestSentenceBatch(
    `/${encodeURIComponent(batchId)}/sentences/${index + 1}`,
    signal,
    { method: "POST", headers: { "Content-Type": "audio/wav" }, body: blob },
    batchId,
  );
}
export function cancelSentenceBatch(
  batchId: string,
  signal: AbortSignal,
): Promise<SentenceBatch> {
  return requestSentenceBatch(
    `/${encodeURIComponent(batchId)}/cancellations`,
    signal,
    { method: "POST" },
    batchId,
  );
}
