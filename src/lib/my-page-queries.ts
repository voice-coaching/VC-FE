import type { MyPagePeriod, ScoreTrendMetric } from "./api/types";

// Score trends accept a named period only; the backend has no ALL period.
export const GROWTH_QUERY = {
  metric: "PRONUNCIATION" satisfies ScoreTrendMetric,
  period: "YEAR" satisfies MyPagePeriod,
} as const;

/** Explicit dates are supported by statistics and include all account history. */
export function lifetimeStatisticsFilters(createdAt: string) {
  const joined = new Date(createdAt);
  if (Number.isNaN(joined.getTime()))
    throw new Error("가입 날짜를 확인하지 못해 누적 통계를 조회할 수 없어요.");
  const from = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(joined);
  return { from };
}
