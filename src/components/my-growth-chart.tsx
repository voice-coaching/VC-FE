"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { api, type ScoreTrend } from "@/lib/api";
import { groupScoreTrend, type TrendPeriod } from "@/lib/score-trend";
import { GROWTH_QUERY } from "@/lib/my-page-queries";
import styles from "./my-growth-chart.module.css";

const periods = [
  { value: "week", label: "주간", detail: "최근 8주" },
  { value: "month", label: "월간", detail: "최근 6개월" },
  { value: "all", label: "연간", detail: "최근 1년" },
] as const;
export function MyGrowthChart() {
  const [period, setPeriod] = useState<TrendPeriod>("week");
  const [points, setPoints] = useState<ScoreTrend["points"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    api.myPage
      .getScoreTrends(GROWTH_QUERY.metric, GROWTH_QUERY.period)
      .then((result) => {
        if (active) setPoints(result.points);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const buckets = useMemo(
    () => groupScoreTrend(points, period, now),
    [points, period, now],
  );
  const available = buckets.filter((bucket) => bucket.score !== null);
  const latest = available.at(-1);
  const active = buckets.find((bucket) => bucket.key === selected) ?? latest;
  const delta =
    latest && available.length > 1 ? latest.score! - available[0].score! : null;
  return (
    <section className={styles.card} aria-label="성장 그래프">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] leading-[22px] font-bold">성장 그래프</h2>
          <p className="mt-1 text-xs leading-4 font-medium text-[#8b95a1]">
            {period === "week" ? "주간" : period === "month" ? "월간" : "연간"}{" "}
            평균 발음 점수
          </p>
        </div>
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger
            className={styles.period}
            aria-label="성장 그래프 기간 선택"
          >
            {periods.find((item) => item.value === period)?.label}
            <Image
              src="/figma/mypage-improved/period-chevron.svg"
              alt=""
              width={12}
              height={12}
              className={open ? "-rotate-90" : "rotate-90"}
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className={styles.menu}
            >
              <DropdownMenu.RadioGroup
                value={period}
                onValueChange={(value) => {
                  setPeriod(value as TrendPeriod);
                  setSelected(null);
                }}
              >
                {periods.map((option) => (
                  <DropdownMenu.RadioItem
                    key={option.value}
                    value={option.value}
                    className={styles.menuItem}
                  >
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.detail}</small>
                    </span>
                    <DropdownMenu.ItemIndicator>✓</DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {loading ? (
        <div
          role="status"
          className="flex h-[196px] items-center justify-center text-sm text-[#8b95a1]"
        >
          성장 기록을 불러오는 중…
        </div>
      ) : error ? (
        <div role="alert" className="py-8 text-center text-sm text-[#6b7684]">
          성장 기록을 불러오지 못했어요.
          <button
            className="mx-auto mt-3 block min-h-11 px-3 font-bold text-primary"
            onClick={() => setRetry((value) => value + 1)}
          >
            다시 시도
          </button>
        </div>
      ) : !latest ? (
        <div className="py-12 text-center text-sm leading-6 text-[#8b95a1]">
          아직 분석된 발음 점수가 없어요.
          <br />
          연습을 마치면 성장 기록이 쌓여요.
        </div>
      ) : (
        <>
          <div className="mt-[18px] flex min-h-10 flex-wrap items-end gap-2">
            <p className="flex items-baseline gap-0.5">
              <strong className="text-[34px] leading-10 tracking-[-1.02px]">
                {active?.score}
              </strong>
              <b className="text-lg leading-[26px]">점</b>
            </p>
            {selected === null && delta !== null ? (
              <p className="mb-0.5 rounded-full bg-[#eaf0ff] px-2 py-[3px] text-xs leading-4 text-[#4e5968]">
                <b className="text-primary">
                  {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}점
                </b>{" "}
                첫 기록보다
              </p>
            ) : null}
          </div>
          <div
            className={styles.chart}
            role="group"
            aria-label="기간별 평균 발음 점수"
          >
            {buckets.map((bucket, index) => {
              const chosen = active?.key === bucket.key;
              return (
                <button
                  key={bucket.key}
                  disabled={bucket.score === null}
                  aria-pressed={chosen}
                  aria-label={`${bucket.label} ${bucket.score === null ? "연습 기록 없음" : `평균 ${bucket.score}점, ${bucket.count}회 연습`}`}
                  className={styles.barButton}
                  onClick={() => setSelected(bucket.key)}
                >
                  <span className={styles.barArea}>
                    {chosen ? (
                      <span
                        className={styles.tooltip}
                        data-historical={selected !== null}
                      >
                        {bucket.score}
                        {selected !== null ? "점" : ""}
                      </span>
                    ) : null}
                    <span
                      className={styles.bar}
                      data-active={chosen}
                      data-recent={index >= buckets.length - 3}
                      style={{
                        height:
                          bucket.score === null
                            ? 3
                            : Math.max(4, bucket.score * 1.18),
                      }}
                    />
                  </span>
                  <span className={styles.barLabel} data-active={chosen}>
                    {index === buckets.length - 1
                      ? period === "week"
                        ? "이번 주"
                        : "이번 달"
                      : chosen || index === 0
                        ? bucket.label
                        : "\u00a0"}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
