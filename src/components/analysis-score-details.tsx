import {
  formatPublicScore,
  scoreDetailRows,
  unscorableScoreReason,
  type PublicScoreDetails,
} from "@/lib/score-details";

/** Render only AI-provided display scores; the overall score is never recomputed. */
export function AnalysisScoreDetails({
  details,
}: {
  details?: PublicScoreDetails;
}) {
  return (
    <section className="rounded-2xl bg-white p-5" aria-label="음성 세부점수">
      <h2 className="text-[15px] font-bold">음성 세부점수</h2>
      {!details ? (
        <p className="mt-2 text-sm leading-5 text-[#8b95a1]">
          세부점수 미제공 · 이 결과의 6항목 점수를 표시할 수 없어요.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs leading-5 text-[#6b7684]">
            전문가 검증 전 기준에 따른 연습 점수예요.
          </p>
          <p className="mt-3 text-sm text-[#4e5968]">
            음성 종합점수{" "}
            <strong>{formatPublicScore(details.audioScore)}</strong> / 100점
          </p>
          {details.aggregationMode === "AUDIO_VISUAL" && (
            <p className="mt-1 text-xs leading-5 text-[#6b7684]">
              입술 점수 {formatPublicScore(details.visualScore)} / 100점 ·
              종합점수 반영 비율: 음성 {details.audioWeight}% / 입술{" "}
              {details.visualWeight}%
            </p>
          )}
          <dl className="mt-4 divide-y divide-[#f2f4f6]">
            {scoreDetailRows(details).map((row) => (
              <div key={row.criterionId} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm font-medium">{row.label}</dt>
                  <dd className="shrink-0 text-sm tabular-nums">
                    {row.status === "SCORED" ? (
                      <>
                        <strong>{formatPublicScore(row.score)}</strong> / 100점
                      </>
                    ) : (
                      <span className="text-[#8b95a1]">평가 불가</span>
                    )}
                  </dd>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#8b95a1]">
                  음성 종합점수 내부 비중 {row.weight}%
                  {row.status === "UNSCORABLE" &&
                    ` · ${unscorableScoreReason(row.reasonCode)}`}
                </p>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-5 text-[#8b95a1]">
            각 항목은 100점 기준이에요. 세부점수는 반올림되어 있어 직접 합산한
            값과 종합점수 사이에 작은 차이가 날 수 있어요.
          </p>
        </>
      )}
    </section>
  );
}
