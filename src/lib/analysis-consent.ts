import type { AnalysisCapabilities, AnalysisConsentInput } from "./api/types";

/** An explicitly disabled policy has no consent body or invented revision. */
export function voiceProcessingConsentInput(
  capabilities: Pick<
    AnalysisCapabilities,
    "voiceProcessingConsentRequired" | "consentPolicyRevision"
  >,
): AnalysisConsentInput | undefined {
  if (capabilities.voiceProcessingConsentRequired === false) return undefined;
  const revision = capabilities.consentPolicyRevision;
  if (!revision?.trim()) {
    throw new Error("음성 처리 동의 정책 정보를 불러오지 못했습니다.");
  }
  return { accepted: true, policyRevision: revision };
}
