import { canonicalCriterionPoints } from "@/lib/canonical-score";
import type { DirectResult } from "@/lib/direct-analysis";

export function DirectAnalysisResult({ result }: { result: DirectResult }) {
  return (
    <section
      className="space-y-4 rounded-2xl bg-white p-5"
      aria-label="음성 분석 결과"
    >
      <h2 className="text-xl font-bold">
        {result.score.overallScore == null
          ? "점수 미제공"
          : `${result.score.overallScore}점`}
      </h2>
      {result.failure && (
        <p role="alert">분석 근거를 확정하지 못했습니다. 다시 녹음해 주세요.</p>
      )}
      {result.decision.status !== "ACCEPT" && (
        <p>
          이번 입력은 평가를 완료하지 못했습니다. 녹음과 원고를 확인해 주세요.
        </p>
      )}
      {result.score.validity === "RUBRIC_COMPUTED" && (
        <dl>
          {canonicalCriterionPoints(result.score).map((row) => (
            <div key={row.criterionId} className="flex justify-between py-1">
              <dt>{row.label}</dt>
              <dd>
                {row.points == null
                  ? "평가 대상 없음"
                  : `${row.points} / ${row.maxPoints}점`}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {result.coaching.feedback && (
        <p className="whitespace-pre-wrap leading-relaxed">
          {result.coaching.feedback}
        </p>
      )}
      {result.coaching.items.map((item, index) => (
        <article key={index} className="space-y-2 border-t pt-3">
          <h3 className="font-semibold">
            교정 음소: {item.candidate.expectedPhone}
          </h3>
          <p>{item.expression.explanation}</p>
          <p>{item.expression.action}</p>
          <p>{item.expression.practice}</p>
          <p>{item.expression.selfCheck}</p>
          <details className="text-sm text-gray-600">
            <summary>분석 근거와 위치</summary>
            {item.candidate.facts.map((fact) => (
              <p key={fact.evidenceId}>
                {fact.location.word} · 기대 음소 위치 {fact.expectedIndex}
                {fact.location.phoneStartS != null &&
                fact.location.phoneEndS != null
                  ? ` · ${fact.location.phoneStartS.toFixed(2)}–${fact.location.phoneEndS.toFixed(2)}초 (MFA 위치)`
                  : " · 음소 시간 위치 미확정"}
                <span className="block break-all">
                  근거 ID: {fact.evidenceId}
                </span>
              </p>
            ))}
          </details>
        </article>
      ))}
      {result.coaching.items.length === 0 && !result.coaching.feedback && (
        <p>
          이번 분석에서 제공할 교정 항목이 없습니다. 모든 발음이 정확하다는
          의미는 아닙니다.
        </p>
      )}
      <p className="text-xs text-gray-500">
        점수는 이번 원고의 분석 근거에 한정됩니다. 다른 원고 또는 이전 채점
        방식과 직접 비교하지 마세요.
      </p>
    </section>
  );
}
