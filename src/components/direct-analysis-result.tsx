import Image from "next/image";
import { AnalysisSummary } from "@/components/analysis-summary";
import { canonicalCriterionPoints } from "@/lib/canonical-score";
import type { DirectResult } from "@/lib/direct-analysis";

function scoreText(score: number | null) {
  return score == null ? "—" : String(Math.round(score));
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
    value,
  );
}

export function DirectAnalysisResult({ result }: { result: DirectResult }) {
  const criteria = canonicalCriterionPoints(result.score);
  const summary =
    result.coaching.items[0]?.expression.explanation ??
    (result.decision.status === "ACCEPT"
      ? "음성 분석을 완료했어요. 항목별 결과를 확인해 보세요."
      : "이번 입력은 평가를 완료하지 못했어요. 녹음과 문장을 다시 확인해 주세요.");

  return (
    <section className="space-y-5" aria-label="음성 분석 결과">
      <AnalysisSummary text={summary} />

      {result.failure || result.decision.status !== "ACCEPT" ? (
        <div
          role="alert"
          className="rounded-2xl bg-[#fff2f3] px-4 py-3 text-[13px] leading-5 text-[#d83b4b]"
        >
          {result.failure
            ? "분석 근거를 확정하지 못했어요. 다시 녹음해 주세요."
            : "이번 입력은 평가를 완료하지 못했어요. 녹음과 문장을 확인해 주세요."}
        </div>
      ) : null}

      <section className="flex min-h-[88px] items-center gap-3 rounded-[20px] bg-white p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] leading-6 font-bold">종합 점수</h2>
          <p className="mt-1 text-[12px] leading-4 text-[#8b95a1]">
            이번 녹음의 발음 분석 결과예요
          </p>
        </div>
        <span className="flex items-end gap-1">
          <b className="text-[24px] leading-8 text-primary">
            {scoreText(result.score.overallScore)}
          </b>
          {result.score.overallScore != null ? (
            <span className="pb-1 text-[12px] leading-4 text-[#8b95a1]">
              / 100
            </span>
          ) : null}
        </span>
      </section>

      {criteria.length ? (
        <section className="overflow-hidden rounded-[20px] bg-white">
          <div className="px-5 pt-5 pb-2">
            <h2 className="text-[17px] leading-6 font-bold">항목별 점수</h2>
            <p className="mt-1 text-[12px] leading-4 text-[#8b95a1]">
              발음 기준별 점수를 확인해 보세요
            </p>
          </div>
          <dl className="divide-y divide-[#f2f4f6] px-5 pb-2">
            {criteria.map((row) => (
              <div
                key={row.criterionId}
                className="flex min-h-12 items-center justify-between gap-3"
              >
                <dt className="text-[14px] font-medium text-[#4e5968]">
                  {row.label}
                </dt>
                <dd className="shrink-0 text-[14px] font-bold text-[#191f28]">
                  {row.points == null ? (
                    <span className="text-[12px] font-medium text-[#8b95a1]">
                      평가 대상 없음
                    </span>
                  ) : (
                    <>
                      {formatPoints(row.points)}
                      <span className="font-medium text-[#8b95a1]">
                        {` / ${formatPoints(row.maxPoints)}점`}
                      </span>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {result.coaching.items.length ? (
        <div className="space-y-3">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-[17px] leading-6 font-bold">
              다시 확인해 보세요
            </h2>
            <span className="text-[13px] font-bold text-[#f04f5f]">
              {result.coaching.items.length}개
            </span>
          </div>
          {result.coaching.items.map((item, index) => (
            <article
              key={item.candidate.candidateId}
              className="rounded-[20px] bg-white p-5"
            >
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-md bg-[#fff2f3] px-2 py-1 text-[11px] font-bold text-[#f04f5f]">
                  <Image
                    src="/figma/report/warning.svg"
                    alt=""
                    width={12}
                    height={12}
                  />
                  교정 음소 {index + 1}
                </span>
                <strong className="text-[18px] leading-6">
                  {item.candidate.expectedPhone}
                </strong>
              </div>
              <p className="mt-3 text-[14px] leading-6 font-medium text-[#333d4b]">
                {item.expression.explanation}
              </p>
              <div className="mt-4 space-y-3 rounded-2xl bg-[#f8f9fa] p-4">
                <FeedbackRow label="발음 방법" text={item.expression.action} />
                <FeedbackRow label="연습하기" text={item.expression.practice} />
                <FeedbackRow
                  label="확인하기"
                  text={item.expression.selfCheck}
                />
              </div>
              {item.candidate.facts.length ? (
                <details className="mt-3 text-[12px] leading-5 text-[#8b95a1]">
                  <summary className="min-h-11 cursor-pointer py-3 font-bold text-[#4e5968] marker:hidden">
                    분석 위치 보기
                  </summary>
                  <div className="space-y-1 border-t border-[#eef0f3] pt-3">
                    {item.candidate.facts.map((fact) => (
                      <p key={fact.evidenceId}>
                        {fact.location.word} · {fact.expectedIndex + 1}번째 음소
                        {fact.location.phoneStartS != null &&
                        fact.location.phoneEndS != null
                          ? ` · ${fact.location.phoneStartS.toFixed(2)}–${fact.location.phoneEndS.toFixed(2)}초`
                          : ""}
                      </p>
                    ))}
                  </div>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <section className="rounded-[20px] bg-white p-5">
          <h2 className="text-[17px] leading-6 font-bold">이번 연습 결과</h2>
          <p className="mt-2 text-[13px] leading-5 text-[#8b95a1]">
            이번 분석에서는 별도의 교정 항목이 제공되지 않았어요.
          </p>
        </section>
      )}

      <p className="px-1 text-[11px] leading-5 text-[#8b95a1]">
        점수는 이번 원고와 녹음에서 확인된 분석 근거를 기준으로 표시됩니다.
      </p>
    </section>
  );
}

function FeedbackRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <strong className="text-[12px] leading-4 text-primary">{label}</strong>
      <p className="mt-1 text-[13px] leading-5 text-[#4e5968]">{text}</p>
    </div>
  );
}
