import type { CanonicalAnalysisView } from "@/lib/canonical-analysis";
import { canonicalCriterionPoints } from "@/lib/canonical-score";

export function CanonicalScoreCriteria({
  view,
}: {
  view: CanonicalAnalysisView;
}) {
  const score = view.canonicalAnalysis?.score;
  if (score?.validity !== "RUBRIC_COMPUTED") return null;
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="text-[15px] font-bold">항목별 점수</h2>
      <p className="mt-1 text-xs text-[#6b7684]">받은 점수 / 배점</p>
      {score.rubricRevision === "phone-rubric-native-v1" && (
        <p className="mt-2 text-xs leading-5 text-[#6b7684]">
          채점 기준이 변경되어 이전 방식의 점수와 직접 비교할 수 없습니다. 일부
          모음은 같은 관측 범주로 평가합니다.
        </p>
      )}
      <dl className="mt-3 space-y-2">
        {canonicalCriterionPoints(score).map((row) => (
          <div
            key={row.criterionId}
            className="flex justify-between gap-3 text-sm"
          >
            <dt>{row.label}</dt>
            <dd className="shrink-0 text-right tabular-nums">
              {row.points == null ? (
                <span className="text-[#6b7684]">평가 대상 없음</span>
              ) : (
                <>
                  <strong>{row.points}</strong>
                  <span className="text-[#6b7684]"> / {row.maxPoints}점</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-5 text-[#6b7684]">
        각 항목은 배점 기준으로 표시하며, 평가 대상 항목의 점수를 합산해 100점
        만점으로 환산한 값이 종합점수입니다. 원고에 없는 항목은 합산에서
        제외합니다. 점수는 이번 녹음의 분석 근거를 기준으로 계산하며, 다른
        원고와 난이도가 같다는 뜻이나 모든 발음이 정확하다는 보증은 아닙니다.
      </p>
    </section>
  );
}
