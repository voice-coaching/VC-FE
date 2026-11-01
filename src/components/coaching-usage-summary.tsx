"use client";

import { useCoachingUsage } from "@/hooks/use-coaching-usage";
import { coachingPeriodDate } from "@/lib/coaching-usage";

export function CoachingUsageSummary({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { data, isPending, isError, isFetching, refetch } = useCoachingUsage();
  return (
    <section
      aria-label="내 코칭 사용량"
      className="mt-3 space-y-1.5 rounded-xl bg-white/80 p-3 text-xs leading-5 text-[#6b7684]"
    >
      {isPending && <p role="status">코칭 사용량 확인 중…</p>}
      {isError && (
        <div role="alert">
          <p>코칭 사용량을 확인하지 못했어요.</p>
          <button
            type="button"
            className="min-h-11 font-semibold text-primary"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            사용량 다시 확인
          </button>
        </div>
      )}
      {data && (
        <>
          {isError && <p>마지막으로 확인한 사용량이에요.</p>}
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span>남은 코칭</span>
            <strong className="text-base text-[#191f28]">
              {data.unlimited
                ? "횟수 제한 없음"
                : `${data.remaining}회 / ${data.limit}회`}
            </strong>
          </p>
          {!data.unlimited && (
            <p>
              사용 완료 {data.used}회 · 분석 중 예약 {data.reserved}회
            </p>
          )}
          {data.unlimited ? (
            <p>테스트 관리자 · 원고 300자·음성 90초 제한은 적용돼요.</p>
          ) : (
            <>
              {!compact && (
                <p>
                  {data.membershipType === "free"
                    ? "최초 한 달 무료 체험 · 매월 새로 지급되지 않아요."
                    : "TEST 이용권 · 이용기간당 제공되는 코칭이에요."}
                </p>
              )}
              {data.expiresAt && (
                <p>
                  종료:{" "}
                  <time dateTime={data.expiresAt}>
                    {coachingPeriodDate(data.expiresAt)}
                  </time>{" "}
                  (한국 시간)
                </p>
              )}
              {!compact && data.startsAt && (
                <p>
                  시작:{" "}
                  <time dateTime={data.startsAt}>
                    {coachingPeriodDate(data.startsAt)}
                  </time>{" "}
                  (한국 시간)
                </p>
              )}
              {!data.canRequestCoaching && (
                <p className="font-semibold text-[#d64545]">
                  {data.expiresAt && Date.parse(data.expiresAt) <= Date.now()
                    ? "이용기간이 종료됐어요."
                    : "이용 가능한 코칭 횟수가 없어요."}{" "}
                  기존 결과는 계속 볼 수 있어요.
                </p>
              )}
            </>
          )}
          {!compact && (
            <p>
              분석 접수 시 1회가 예약돼요. 코칭을 제공하지 못한 분석은 반환돼요.
            </p>
          )}
          {compact && !data.unlimited && (
            <p>분석 1건당 원고 300자·음성 90초 이내</p>
          )}
        </>
      )}
    </section>
  );
}
