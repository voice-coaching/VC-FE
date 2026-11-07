import type { AnalysisCapabilities } from "@/lib/api/types";
import type { LipProcessingConsent } from "@/lib/lip-analysis";

/** Display the transfer scope before the user accepts each currently required policy. */
export function LipProcessingConsentFields({
  capabilities,
  accepted,
  onChange,
  busy,
  error,
  onRetry,
}: {
  capabilities: AnalysisCapabilities | null;
  accepted: LipProcessingConsent;
  onChange: (value: LipProcessingConsent) => void;
  busy: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section
      className="mt-4 space-y-3 text-sm"
      aria-label="영상 분석 및 처리 안내"
    >
      <p className="text-xs leading-5 text-muted-foreground">
        분석을 요청하면 선택한 촬영본의 얼굴·입술 영상과 내장 음성을 서버로
        전송해 발음과 입술 움직임을 분석합니다. 참조 자료와 관측 범위에 따라
        입술 점수는 제공되지 않을 수 있어요.
      </p>
      {busy ? (
        <p role="status">영상 분석 지원 및 동의 정책을 확인하고 있어요.</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 min-h-11 font-bold text-primary"
          >
            지원 정보 다시 확인
          </button>
        </div>
      ) : null}
      {capabilities && !busy && !error ? (
        <>
          {capabilities.videoProcessingConsentRequired && (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-6 shrink-0 accent-[#6346f6]"
                checked={
                  accepted.videoPolicyRevision ===
                  capabilities.videoProcessingConsentPolicyRevision
                }
                onChange={(event) =>
                  onChange({
                    ...accepted,
                    videoPolicyRevision: event.target.checked
                      ? capabilities.videoProcessingConsentPolicyRevision
                      : null,
                  })
                }
              />
              <span>영상·내장 음성 전송 및 입술 분석 처리에 동의합니다.</span>
            </label>
          )}
          {capabilities.voiceProcessingConsentRequired && (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-6 shrink-0 accent-[#6346f6]"
                checked={
                  accepted.voicePolicyRevision ===
                  capabilities.consentPolicyRevision
                }
                onChange={(event) =>
                  onChange({
                    ...accepted,
                    voicePolicyRevision: event.target.checked
                      ? capabilities.consentPolicyRevision
                      : null,
                  })
                }
              />
              <span>내장 음성의 AI 발음 분석 및 처리에 동의합니다.</span>
            </label>
          )}
          {(capabilities.videoProcessingConsentRequired ||
            capabilities.voiceProcessingConsentRequired) && (
            <p className="text-xs leading-5 text-muted-foreground">
              동의하지 않아도 촬영본을 기기에서 확인할 수 있어요. AI 분석은
              필요한 항목에 동의한 경우에만 요청할 수 있어요.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
