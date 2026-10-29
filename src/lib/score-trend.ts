import type { ScoreTrend } from "./api/types";

export type TrendPeriod = "week" | "month" | "all";
export type TrendBucket = {
  key: string;
  label: string;
  score: number | null;
  count: number;
};

function key(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
export function groupScoreTrend(
  points: ScoreTrend["points"],
  period: TrendPeriod,
  now = new Date(),
): TrendBucket[] {
  const valid = points.filter(
    (point) =>
      Number.isFinite(point.score) &&
      point.score >= 0 &&
      point.score <= 100 &&
      point.sessionCount > 0 &&
      !Number.isNaN(new Date(point.date).getTime()) &&
      new Date(point.date) <= now,
  );
  const end =
    period === "week"
      ? startOfWeek(now)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(end);
  if (period === "week") start.setDate(start.getDate() - 49);
  else if (period === "month") start.setMonth(start.getMonth() - 5);
  else if (valid.length) {
    const first = new Date(
      Math.min(...valid.map((point) => new Date(point.date).getTime())),
    );
    start.setFullYear(first.getFullYear(), first.getMonth(), 1);
  }
  const sums = new Map<string, { total: number; count: number }>();
  for (const point of valid) {
    const date = new Date(point.date);
    const bucket =
      period === "week"
        ? startOfWeek(date)
        : new Date(date.getFullYear(), date.getMonth(), 1);
    const bucketKey = key(bucket);
    const current = sums.get(bucketKey) ?? { total: 0, count: 0 };
    sums.set(bucketKey, {
      total: current.total + point.score * point.sessionCount,
      count: current.count + point.sessionCount,
    });
  }
  const result: TrendBucket[] = [];
  for (const date = new Date(start); date <= end;) {
    const bucketKey = key(date);
    const sum = sums.get(bucketKey);
    result.push({
      key: bucketKey,
      label:
        period === "week"
          ? `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`
          : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`,
      score: sum ? Math.round(sum.total / sum.count) : null,
      count: sum?.count ?? 0,
    });
    if (period === "week") date.setDate(date.getDate() + 7);
    else date.setMonth(date.getMonth() + 1);
  }
  return result;
}
