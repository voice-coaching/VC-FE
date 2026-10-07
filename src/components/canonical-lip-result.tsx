import type { CanonicalAnalysisView } from "@/lib/canonical-analysis";

const states: Record<string, string> = {
  OBSERVED: "입술 움직임 관찰 완료",
  REFERENCE_ONLY: "참조 영상과 비교 완료",
  SCORED: "입술 평가 완료",
  UNSCORABLE: "입술 점수를 계산할 수 없어요",
  FAILED: "영상 분석을 완료하지 못했어요",
  TIMEOUT: "영상 분석 시간이 초과됐어요",
  NOT_PROVIDED: "분석할 영상이 없어요",
};
const reasons: Record<string, string> = {
  SYNC_UNCERTAIN: "음성과 영상의 시간 연결을 확인하지 못했어요.",
  REFERENCE_MISSING: "이 발음에 맞는 참조 영상이 아직 없어요.",
  CALIBRATION_MISSING: "검증된 점수 기준이 아직 없어요.",
};

export function CanonicalLipResult({ view }: { view: CanonicalAnalysisView }) {
  const visual = view.canonicalAnalysis?.visual;
  if (!visual || visual.status === "NOT_CONNECTED") return null;
  return (
    <section className="rounded-2xl bg-white p-5" aria-label="입술 움직임 분석">
      <h2 className="text-base font-bold">입술 움직임</h2>
      <p className="mt-2 text-sm">{states[visual.status]}</p>
      <p className="mt-2 text-lg font-bold">
        {visual.scoreKind === "CALIBRATED" && visual.score !== null
          ? `${visual.score}점 / 100점`
          : "점수 미제공"}
      </p>
      <p className="mt-2 text-xs leading-5 text-[#6b7684]">
        정렬된 자음 {visual.coverage.targetCount}개 중{" "}
        {visual.coverage.observedCount}개에서 입술 움직임을 관찰했어요. 입술
        점수는 음성 종합 점수에 합산하지 않아요.
      </p>
      {visual.reasonCodes.map((code) =>
        reasons[code] ? (
          <p key={code} className="mt-1 text-xs text-[#6b7684]">
            {reasons[code]}
          </p>
        ) : null,
      )}
      {visual.phoneAssessments.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium">
            발음별 관찰 보기
          </summary>
          <ul className="mt-2 space-y-3">
            {visual.phoneAssessments.map((phone) => (
              <li
                key={phone.expectedIndex}
                className="border-t border-[#f2f4f6] pt-2 text-sm"
              >
                <div className="flex justify-between gap-2">
                  <span>
                    {phone.expectedPhone} ·{" "}
                    {phone.role === "coda"
                      ? "받침"
                      : phone.role === "onset"
                        ? "첫소리"
                        : "모음"}
                  </span>
                  <span>
                    {phone.scoreKind === "CALIBRATED" && phone.score !== null
                      ? `${phone.score}점`
                      : phone.scoreKind === "REFERENCE_SIMILARITY" &&
                          phone.score !== null
                        ? `연구용 유사도 ${phone.score}`
                        : "점수 미제공"}
                  </span>
                </div>
                {phone.audioStartSeconds !== null &&
                  phone.audioEndSeconds !== null && (
                    <p className="mt-1 text-xs text-[#6b7684]">
                      음성 {phone.audioStartSeconds.toFixed(2)}–
                      {phone.audioEndSeconds.toFixed(2)}초
                    </p>
                  )}
                <p className="mt-1 text-xs text-[#6b7684]">
                  {phone.observations.length
                    ? `입술 움직임 관찰 · ${phone.frameCount}프레임`
                    : "신뢰할 수 있는 입술 관찰 없음"}
                </p>
              </li>
            ))}
          </ul>
          {visual.omittedPhoneAssessmentCount > 0 && (
            <p className="mt-2 text-xs text-[#6b7684]">
              추가 {visual.omittedPhoneAssessmentCount}개 구간은 상세 근거에
              보관됐어요.
            </p>
          )}
        </details>
      )}
    </section>
  );
}
