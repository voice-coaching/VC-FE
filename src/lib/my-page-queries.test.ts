import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createRemoteApi } from "./api/remote";
import { ApiError } from "./api/client";
import type { MyPagePeriod } from "./api/types";
import { GROWTH_QUERY, lifetimeStatisticsFilters } from "./my-page-queries";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("MyPage requests lifetime dates and a supported trend period instead of ALL", async () => {
  const calls: URL[] = [];
  // Values accepted by VC-BE MyPagePeriod; unknown values return INVALID_INPUT_VALUE.
  const accepted = new Set(["WEEK", "MONTH", "THREE_MONTHS", "YEAR"]);
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const period = url.searchParams.get("period");
    if (period && !accepted.has(period))
      return Response.json(
        {
          result: false,
          message: "잘못된 입력값입니다.",
          code: "INVALID_INPUT_VALUE",
        },
        { status: 400 },
      );
    return Response.json({
      result: true,
      data: url.pathname.endsWith("score-trends")
        ? { metric: "PRONUNCIATION", points: [] }
        : { totalLearningSeconds: 12345 },
    });
  };
  const api = createRemoteApi("https://backend.example.test");
  await assert.rejects(
    api.myPage.getScoreTrends("PRONUNCIATION", "ALL" as MyPagePeriod),
    (reason: unknown) => reason instanceof ApiError && reason.status === 400,
  );
  const statistics = await api.myPage.getStatistics(
    lifetimeStatisticsFilters("2020-01-01T09:00:00+09:00"),
  );
  const trend = await api.myPage.getScoreTrends(
    GROWTH_QUERY.metric,
    GROWTH_QUERY.period,
  );
  assert.equal(statistics.totalLearningSeconds, 12345);
  assert.deepEqual(trend.points, []);
  assert.equal(calls[1].search, "?from=2020-01-01");
  assert.equal(calls[2].search, "?metric=PRONUNCIATION&period=YEAR");
});

test("lifetime starts on the signup date in the backend's Seoul timezone", () => {
  assert.deepEqual(lifetimeStatisticsFilters("2026-01-01T15:30:00Z"), {
    from: "2026-01-02",
  });
  assert.deepEqual(lifetimeStatisticsFilters("2026-01-02T00:30:00+09:00"), {
    from: "2026-01-02",
  });
  assert.throws(() => lifetimeStatisticsFilters("invalid"), /가입 날짜/);
});
