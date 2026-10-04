import { z } from "zod";
import { ApiError, createHttpClient } from "./client";
import { HANDOFF_PROFILE } from "../canonical-analysis";
import { HANDOFF_RESULT_HEADER } from "./canonical";

export type AnalysisScope =
  "STANDALONE_AUDIO" | "COURSE" | "TITLE_EXAM" | "VIDEO";
const scope = z.object({
  supported: z.boolean(),
  reasonCode: z.string().nullable(),
});
const capabilities = z.object({
  capabilityVersion: z.literal("voice-coaching.analysis-capabilities.v1"),
  analysisProfile: z.literal(HANDOFF_PROFILE),
  resultSchemas: z.array(z.string()),
  admissionEnabled: z.boolean(),
  scopes: z.object({
    STANDALONE_AUDIO: scope,
    COURSE: scope,
    TITLE_EXAM: scope,
    VIDEO: scope,
  }),
});
const messages: Record<AnalysisScope, string> = {
  STANDALONE_AUDIO:
    "현재 음성 분석을 이용할 수 없습니다. 잠시 후 다시 확인해 주세요.",
  COURSE: "현재 클래스 분석은 준비 중입니다. 단독 음성 연습을 이용해 주세요.",
  TITLE_EXAM:
    "현재 승급 시험 분석은 준비 중입니다. 연습 점수는 승급 채점에 사용되지 않습니다.",
  VIDEO: "현재 영상 분석은 준비 중입니다. 단독 음성 연습을 이용해 주세요.",
};

/** Check before recording and again before upload. An older response never means all scopes are supported. */
export async function requireAnalysisScope(
  requested: AnalysisScope,
  signal?: AbortSignal,
) {
  const raw = await createHttpClient("/api/backend").request<unknown>(
    "/api/analysis-capabilities/canonical",
    {
      cache: "no-store",
      signal,
      endpointErrorsOnly: true,
    },
  );
  const parsed = capabilities.safeParse(raw);
  if (!parsed.success)
    throw new ApiError(
      "분석 지원 정보를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.",
      503,
      "ANALYSIS_CAPABILITIES_UNAVAILABLE",
    );
  const value = parsed.data;
  const selected = value.scopes[requested];
  if (!selected.supported)
    throw new ApiError(
      messages[requested],
      409,
      selected.reasonCode ?? "ANALYSIS_SCOPE_UNSUPPORTED",
    );
  if (
    !value.admissionEnabled ||
    !value.resultSchemas.includes(HANDOFF_RESULT_HEADER)
  )
    throw new ApiError(
      messages.STANDALONE_AUDIO,
      503,
      "ANALYSIS_INTEGRATION_UNAVAILABLE",
    );
  return value;
}
