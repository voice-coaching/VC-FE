import type { SixDimensionView } from "@/lib/six-dimension";

const scopeDescriptions: Record<string, string> = {
  pronunciation_accuracy: "기대 음소에 대한 음향 모델의 지지",
  speaking_rate: "중간 쉼을 포함한 읽기 속도",
  articulation_rate: "검출된 묵음을 제외한 읽기 속도",
  pauses: "묵음의 빈도와 길이",
  pitch: "발화 전체의 음높이 변화 폭",
  intensity: "녹음 안에서의 상대 강도 변화 폭",
};

export function SixDimensionResult({ value }: { value: SixDimensionView }) {
  const labels = new Map(value.criteria.map(c => [c.criterionId, c.label]));
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="6개 항목 음성 평가">
      <div>
        <h2 className="text-base font-bold">항목별 음성 평가</h2>
        <p className="mt-1 text-xs text-slate-500">전문가 검토 전 임시 기준으로 계산한 연습용 점수입니다.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {value.criteria.map(c => (
          <div key={c.criterionId} className="rounded-xl bg-slate-50 p-3">
            <h3 className="text-sm font-semibold">{c.label}</h3>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {c.score === null ? <span className="text-sm text-slate-500">측정 불가</span> : <>{c.score.toFixed(1)}<span className="ml-1 text-xs font-normal">/ 100</span></>}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{scopeDescriptions[c.criterionId]}</p>
          </div>
        ))}
      </div>
      {value.feedback.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold">우선 연습할 {value.feedback.length}개 항목</h3>
          {value.feedback.map(item => (
            <article key={item.criterionId} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <h4 className="text-sm font-bold">{labels.get(item.criterionId)}</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.observation}</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6">{item.practice}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{value.status === "UNSCORABLE"
          ? "평가에 필요한 측정 근거가 부족합니다."
          : "측정된 점수는 확인할 수 있지만 연습 피드백을 생성하지 못했습니다."}</p>
      )}
    </section>
  );
}
