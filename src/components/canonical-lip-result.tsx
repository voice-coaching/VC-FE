import Image from "next/image";
import type { LipVisual } from "@/lib/canonical-lip";
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
  NO_FRAME_IN_ALIGNED_SPAN: "해당 발음의 시간 구간에 관측 프레임이 없어요.",
  CALIBRATION_MISSING: "검증된 점수 기준이 아직 없어요.",
};

export function CanonicalLipResult({
  view,
  isCameraPractice,
}: {
  view: CanonicalAnalysisView;
  isCameraPractice: boolean;
}) {
  if (!isCameraPractice) return null;

  const core = view.canonicalAnalysis;
  const visual = core?.visual;
  if (
    !visual ||
    visual.status === "NOT_CONNECTED" ||
    view.jobStatus !== "COMPLETED" ||
    core.decision.status !== "ACCEPT" ||
    !core.feedbackDeliveryAllowed
  )
    return null;
  return <LipVisualResult visual={visual} />;
}

/** Also used by AI-owned video jobs without fabricating a Backend canonical view. */
export function LipVisualResult({ visual }: { visual: LipVisual }) {
  const provisional =
    visual.scoreKind === "PROVISIONAL" ||
    visual.phoneAssessments.some((phone) => phone.scoreKind === "PROVISIONAL");
  return (
    <section className="rounded-2xl bg-white p-5" aria-label="입술 움직임 분석">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <Image
          src="/figma/lip-quick-start/report-camera.svg"
          width={18}
          height={18}
          alt=""
        />
        입모양 피드백
      </h2>
      <p className="mt-2 text-sm">{states[visual.status]}</p>
      <p className="mt-2 text-lg font-bold">
        {visual.score !== null && visual.scoreKind === "PROVISIONAL"
          ? `임시 참조 적합성 ${visual.score}점 / 100점`
          : visual.scoreKind === "CALIBRATED" && visual.score !== null
            ? `${visual.score}점 / 100점`
            : "점수 미제공"}
      </p>
      {visual.score === null && (
        <p className="mt-2 text-xs leading-5 text-[#6b7684]">
          전체 입술 점수를 평가할 정보가 부족해요. 음성 종합점수와 제공된 발음별
          관찰은 계속 확인할 수 있어요.
        </p>
      )}
      {provisional && (
        <p className="mt-2 text-xs leading-5 text-[#6b7684]">
          임시 참조 적합성은 제한된 참조 자료와 비교한 값이며, 전문가 검증
          점수나 발음 정답률이 아니에요.
        </p>
      )}
      <p className="mt-2 text-xs leading-5 text-[#6b7684]">
        분석 대상 음소 {visual.coverage.targetCount}개 중{" "}
        {visual.coverage.observedCount}개에서 입술 움직임을 관찰했어요.
        종합점수는 서버가 제공한 값을 그대로 표시해요.
      </p>
      <LipSubScores scores={visual.subScores} />
      {visual.unresolvedExpectedIndices.length > 0 && (
        <p className="mt-1 text-xs text-[#6b7684]">
          {visual.unresolvedExpectedIndices.length}개 음소는 정확한 시간 구간을
          확인하지 못했어요.
        </p>
      )}
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
                    {phone.scoreKind === "PROVISIONAL" && phone.score !== null
                      ? `임시 참조 적합성 ${phone.score}점`
                      : phone.scoreKind === "CALIBRATED" && phone.score !== null
                        ? `${phone.score}점`
                        : phone.scoreKind === "REFERENCE_SIMILARITY" &&
                            phone.score !== null
                          ? `연구용 유사도 ${phone.score}`
                          : "점수 미제공"}
                  </span>
                </div>
                <LipSubScores scores={phone.subScores} />
                {phone.allowedActionIds.includes("COMPARE_REFERENCE") && (
                  <p className="mt-1 text-xs text-[#6b7684]">
                    참조 비교 연습 · 확정된 발음 교정 방향을 뜻하지 않아요.
                  </p>
                )}
                {phone.audioStartSeconds !== null &&
                  phone.audioEndSeconds !== null && (
                    <p className="mt-1 text-xs text-[#6b7684]">
                      음성 {phone.audioStartSeconds.toFixed(2)}–
                      {phone.audioEndSeconds.toFixed(2)}초
                    </p>
                  )}
                <p className="mt-1 text-xs text-[#6b7684]">
                  {phone.observations.length ||
                  phone.subScores?.some((item) => item.measurements?.length)
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

/** Subscores explain their parent; never total them or turn missing evidence into zero. */
function LipSubScores({ scores }: { scores?: LipVisual["subScores"] }) {
  if (!scores?.length) return null;
  return (
    <dl className="mt-3 space-y-2 text-xs" aria-label="입술 하위 항목">
      {scores.map((item, index) => (
        <div
          key={`${item.criterionId}-${index}`}
          className="flex justify-between gap-3"
        >
          <dt>{item.label}</dt>
          <dd>
            {item.status === "SCORED" && item.score !== null
              ? `${item.score}점`
              : item.status === "NOT_APPLICABLE"
                ? "평가 대상 아님"
                : "평가 정보 부족"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
