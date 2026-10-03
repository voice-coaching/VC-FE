import type { CanonicalAnalysisView } from "@/lib/canonical-analysis";
import { scoreCriteria } from "@/lib/canonical-score";

export function CanonicalScoreCriteria({
  view,
}: {
  view: CanonicalAnalysisView;
}) {
  const score = view.canonicalAnalysis?.score;
  if (score?.validity !== "RUBRIC_COMPUTED") return null;
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="text-[15px] font-bold">항목별 평가 단계</h2>
      <dl className="mt-3 space-y-2">
        {score.criteria.map((row, index) => (
          <div
            key={row.criterionId}
            className="flex justify-between gap-3 text-sm"
          >
            <dt>{scoreCriteria[index][1]}</dt>
            <dd>
              {row.level == null ? "평가 대상 없음" : `${row.level} / 4단계`}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-5 text-[#6b7684]">
        원고에 없는 항목은 합산에서 제외합니다. 점수는 이번 녹음의 분석 근거를
        기준으로 계산하며, 다른 원고와 난이도가 같다는 뜻이나 모든 발음이
        정확하다는 보증은 아닙니다.
      </p>
    </section>
  );
}
