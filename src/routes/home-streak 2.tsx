"use client";

import { ChevronLeft, ChevronRight, Flame, Target, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { api, type Statistics, type TrainingHistoryItem } from "@/lib/api";
import { buildMonthCalendar, completedDays, monthRange } from "@/lib/streak";
import { useProfile } from "@/lib/use-profile";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function HomeStreak() {
  const { profile } = useProfile();
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [sessions, setSessions] = useState<TrainingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [goalSheet, setGoalSheet] = useState(false);

  const load = useCallback(() => {
    let active = true;
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const range = monthRange(year, month);
    setLoading(true);
    setError(null);
    void Promise.all([
      api.myPage.getStatistics({ from: range.from, to: range.to }),
      api.myPage.listTrainingSessions({
        status: "COMPLETED",
        from: range.from,
        to: range.to,
        page: 0,
        size: 100,
      }),
    ])
      .then(([stats, history]) => {
        if (!active) return;
        setStatistics(stats);
        setSessions(history.items);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "연속 연습 기록을 불러오지 못했습니다.",
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [visibleMonth]);

  useEffect(load, [load, retryKey]);

  const calendar = useMemo(
    () =>
      buildMonthCalendar(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth(),
        sessions,
        today,
      ),
    [sessions, today, visibleMonth],
  );
  const monthCompletedDays = completedDays(calendar);
  const weeklyGoal = profile?.weeklySessions ?? statistics?.todayGoalCount ?? 0;

  return (
    <AppShell nav={false}>
      <TopBar to="/home" title="연속 연습" />
      <div className="px-5 pb-10">
        <section className="rounded-[24px] bg-primary px-5 py-6 text-white shadow-[0_14px_32px_rgb(0_128_255_/_22%)]">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-[20px] bg-white/18">
              <Flame className="size-8 fill-white" />
            </span>
            <div>
              <p className="text-sm text-white/80">현재 연속 기록</p>
              <strong className="mt-1 block text-[30px] leading-9">
                {statistics?.consecutiveLearningDays ?? 0}일
              </strong>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/20 pt-5 text-center">
            <p>
              <strong className="block text-xl">{monthCompletedDays}일</strong>
              <span className="mt-1 block text-xs text-white/75">
                이번 달 연습
              </span>
            </p>
            <p>
              <strong className="block text-xl">
                {statistics?.totalSessionCount ?? 0}회
              </strong>
              <span className="mt-1 block text-xs text-white/75">
                이번 달 세션
              </span>
            </p>
          </div>
        </section>

        <section className="design-card mt-4 !p-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() =>
                setVisibleMonth(
                  (value) =>
                    new Date(value.getFullYear(), value.getMonth() - 1, 1),
                )
              }
              className="flex size-11 items-center justify-center rounded-full"
            >
              <ChevronLeft className="size-5" />
            </button>
            <h2 className="text-base font-bold">
              {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
            </h2>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() =>
                setVisibleMonth(
                  (value) =>
                    new Date(value.getFullYear(), value.getMonth() + 1, 1),
                )
              }
              className="flex size-11 items-center justify-center rounded-full"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-2">
                {day}
              </span>
            ))}
            {calendar.map((cell) => (
              <span
                key={cell.key}
                aria-label={
                  cell.day == null
                    ? undefined
                    : `${cell.day}일, ${cell.completedCount}회 연습`
                }
                className="flex h-11 items-center justify-center"
              >
                {cell.day == null ? null : (
                  <span
                    className={`flex size-9 items-center justify-center rounded-full text-sm ${
                      cell.completedCount > 0
                        ? "bg-primary font-bold text-white"
                        : cell.isToday
                          ? "border border-primary font-semibold text-primary"
                          : "text-[#4e5968]"
                    }`}
                  >
                    {cell.day}
                  </span>
                )}
              </span>
            ))}
          </div>
          {loading ? (
            <p
              role="status"
              className="py-4 text-center text-sm text-muted-foreground"
            >
              기록을 불러오는 중…
            </p>
          ) : error ? (
            <div
              role="alert"
              className="py-4 text-center text-sm text-destructive"
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setRetryKey((value) => value + 1)}
                className="mt-3 min-h-11 rounded-full border border-border px-5 font-semibold text-foreground"
              >
                다시 시도
              </button>
            </div>
          ) : null}
        </section>

        <button
          type="button"
          onClick={() => setGoalSheet(true)}
          className="design-card mt-4 flex min-h-20 w-full items-center gap-3 text-left !p-4"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eaf4ff] text-primary">
            <Target className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm">주간 목표</strong>
            <span className="mt-1 block text-xs text-muted-foreground">
              {weeklyGoal > 0
                ? `일주일에 ${weeklyGoal}일 연습`
                : "아직 설정되지 않았어요"}
            </span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      </div>

      {goalSheet ? (
        <div
          className="fixed inset-0 z-50 mx-auto flex max-w-[402px] items-end bg-black/35"
          role="presentation"
          onClick={() => setGoalSheet(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="weekly-goal-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full rounded-t-[28px] bg-white px-5 pt-5 pb-[max(28px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between">
              <h2 id="weekly-goal-title" className="text-lg font-bold">
                주간 연습 목표
              </h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setGoalSheet(false)}
                className="flex size-11 items-center justify-center rounded-full"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-4 rounded-2xl bg-[#f7f8fa] p-4 text-sm leading-6 text-muted-foreground">
              현재 목표는 {weeklyGoal > 0 ? `주 ${weeklyGoal}일` : "설정 전"}
              이에요. 목표 변경은 마이페이지의 연습 계획에서 할 수 있어요.
            </p>
            <a href="/mypage/plan" className="design-action mt-5">
              연습 계획 수정하기
            </a>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
