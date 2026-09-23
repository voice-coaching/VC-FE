"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, type Statistics, type TrainingHistoryItem } from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import {
  CLIENT_CACHE_DAY_MAX_AGE_MS,
  readUserClientCache,
  writeUserClientCache,
} from "@/lib/client-cache";
import { buildMonthCalendar, completedDays, monthRange } from "@/lib/streak";
import { useProfile } from "@/lib/use-profile";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const GOAL_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

type StreakMonthCache = {
  statistics: Statistics;
  sessions: TrainingHistoryItem[];
};

type StreakWeekCache = { sessions: TrainingHistoryItem[] };

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekRange(today: Date) {
  const from = new Date(today);
  const weekday = from.getDay();
  from.setDate(from.getDate() - (weekday === 0 ? 6 : weekday - 1));
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from: dateKey(from), to: dateKey(to), monday: from };
}

export default function HomeStreak() {
  const { profile } = useProfile();
  const today = useMemo(() => new Date(), []);
  const currentWeek = useMemo(() => weekRange(today), [today]);
  const userId = getAuthenticatedUserId();
  const initialMonthRange = useMemo(
    () => monthRange(today.getFullYear(), today.getMonth()),
    [today],
  );
  const [initialMonthCache] = useState(() =>
    readUserClientCache<StreakMonthCache>(
      userId,
      cacheResources.streakMonth(initialMonthRange.from, initialMonthRange.to),
      CLIENT_CACHE_DAY_MAX_AGE_MS,
    ),
  );
  const [initialWeekCache] = useState(() =>
    readUserClientCache<StreakWeekCache>(
      userId,
      cacheResources.streakWeek(currentWeek.from, currentWeek.to),
      CLIENT_CACHE_DAY_MAX_AGE_MS,
    ),
  );
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [statistics, setStatistics] = useState<Statistics | null>(
    initialMonthCache?.statistics ?? null,
  );
  const [sessions, setSessions] = useState<TrainingHistoryItem[]>(
    initialMonthCache?.sessions ?? [],
  );
  const [weeklySessions, setWeeklySessions] = useState<TrainingHistoryItem[]>(
    initialWeekCache?.sessions ?? [],
  );
  const [loading, setLoading] = useState(initialMonthCache === null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [goalSheet, setGoalSheet] = useState(false);

  const load = useCallback(() => {
    let active = true;
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const range = monthRange(year, month);
    const resource = cacheResources.streakMonth(range.from, range.to);
    const cached = readUserClientCache<StreakMonthCache>(
      userId,
      resource,
      CLIENT_CACHE_DAY_MAX_AGE_MS,
    );
    if (cached) {
      setStatistics(cached.statistics);
      setSessions(cached.sessions);
      setLoading(false);
    } else {
      setStatistics(null);
      setSessions([]);
      setLoading(true);
    }
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
        writeUserClientCache<StreakMonthCache>(userId, resource, {
          statistics: stats,
          sessions: history.items,
        });
      })
      .catch((reason) => {
        if (active && !cached) {
          setError(
            reason instanceof Error
              ? reason.message
              : "연속 연습 기록을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId, visibleMonth]);

  useEffect(load, [load, retryKey]);

  useEffect(() => {
    let active = true;
    const resource = cacheResources.streakWeek(
      currentWeek.from,
      currentWeek.to,
    );
    const cached = readUserClientCache<StreakWeekCache>(
      userId,
      resource,
      CLIENT_CACHE_DAY_MAX_AGE_MS,
    );
    if (cached) setWeeklySessions(cached.sessions);
    void api.myPage
      .listTrainingSessions({
        status: "COMPLETED",
        from: currentWeek.from,
        to: currentWeek.to,
        page: 0,
        size: 100,
      })
      .then((history) => {
        if (!active) return;
        setWeeklySessions(history.items);
        writeUserClientCache<StreakWeekCache>(userId, resource, {
          sessions: history.items,
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [currentWeek, retryKey, userId]);

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
  const weeklyGoal = profile?.weeklySessions ?? 0;
  const weeklyCompletedKeys = useMemo(
    () =>
      new Set(
        weeklySessions.map((session) => dateKey(new Date(session.completedAt))),
      ),
    [weeklySessions],
  );
  const goalDays = useMemo(
    () =>
      GOAL_WEEKDAYS.map((label, index) => {
        const date = new Date(currentWeek.monday);
        date.setDate(date.getDate() + index);
        return {
          label,
          completed: weeklyCompletedKeys.has(dateKey(date)),
          isFuture: date > today,
        };
      }),
    [currentWeek, today, weeklyCompletedKeys],
  );
  const weeklyCompleted = goalDays.filter((day) => day.completed).length;
  const remainingGoal = Math.max(0, weeklyGoal - weeklyCompleted);
  const consecutiveDays = statistics?.consecutiveLearningDays ?? 0;

  return (
    <AppShell chromeColor="#2f6bff" className="overflow-hidden bg-[#f2f4f6]">
      <div className="relative h-full overflow-hidden bg-[#f2f4f6] text-[#191f28]">
        <div className="absolute inset-x-0 top-0 h-[222px] bg-[linear-gradient(180deg,#2f6bff_0%,#3f7bff_100%)]" />

        <header className="absolute inset-x-0 top-0 z-20 flex h-12 items-center justify-between px-2 py-1 text-white">
          <Link
            href="/home"
            aria-label="뒤로가기"
            className="flex size-10 items-center justify-center"
          >
            <Image
              src="/figma/home/chevron-left-white.svg"
              alt=""
              width={24}
              height={24}
            />
          </Link>
          <h1 className="text-[17px] leading-6 font-bold">연속 연습</h1>
          <span className="size-10" />
        </header>

        <section className="absolute inset-x-0 top-14 z-10 flex h-[166px] items-center overflow-hidden px-5 pt-3 pb-6 text-white">
          <div className="min-w-0 flex-1 font-bold">
            <div className="flex items-baseline gap-1">
              <strong className="text-[56px] leading-[44px] tracking-[-0.025em]">
                {consecutiveDays}
              </strong>
              <span className="text-2xl leading-8 tracking-[-0.023em]">
                일째
              </span>
            </div>
            <p className="mt-1.5 text-[15px] leading-[22px]">
              연속으로 연습하고 있어요
            </p>
          </div>
          <div className="relative h-[154px] w-[135px] shrink-0 overflow-hidden">
            <Image
              src="/figma/home/streak-character.png"
              alt="연속 연습을 응원하는 Speak AI 캐릭터"
              fill
              priority
              sizes="135px"
              className="scale-[1.12] object-contain"
            />
          </div>
        </section>

        <div className="absolute inset-x-0 top-[198px] bottom-0 z-10 overflow-y-auto rounded-t-[24px] bg-[#f2f4f6] px-5 pt-5 pb-8">
          <section className="grid grid-cols-3 gap-2.5">
            <StatCard
              icon="/figma/home/streak-current.svg"
              value={`${consecutiveDays}일`}
              label="현재 연속"
            />
            <StatCard
              icon="/figma/home/streak-best.svg"
              value="—"
              label="최고 기록"
            />
            <StatCard
              icon="/figma/home/streak-total.svg"
              value={`${monthCompletedDays}일`}
              label="이번 달 연습일"
            />
          </section>

          <section className="mt-3 rounded-[20px] bg-white p-[18px]">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setGoalSheet(true)}
                className="min-w-0 flex-1 text-left"
              >
                <strong className="block text-base leading-[26px]">
                  이번 주 목표
                </strong>
                <span className="mt-0.5 flex items-center text-xs leading-4 font-medium text-[#8b95a1]">
                  {weeklyGoal > 0 ? `주 ${weeklyGoal}일 연습` : "목표 미설정"}
                  <ChevronRight className="size-4" />
                </span>
              </button>
              <p className="flex items-baseline">
                <strong className="text-[17px] leading-6 text-primary">
                  {weeklyCompleted}
                </strong>
                <span className="text-xs leading-4 font-medium text-[#8b95a1]">
                  /{weeklyGoal || 0}일
                </span>
              </p>
            </div>

            <div className="mt-3.5 flex gap-1.5">
              {goalDays.slice(0, weeklyGoal > 0 ? weeklyGoal : 5).map((day) => (
                <span
                  key={day.label}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                >
                  <span
                    className={`h-2.5 w-full rounded-full ${
                      day.completed
                        ? "bg-[linear-gradient(170deg,#5b8cff_15%,#2f6bff_85%)]"
                        : day.isFuture
                          ? "bg-[#eef0f3]"
                          : "bg-[#edf2ff]"
                    }`}
                  />
                  <span
                    className={`text-[11px] leading-[14px] font-medium ${day.isFuture ? "text-[#b0b8c1]" : "text-primary"}`}
                  >
                    {day.label}
                  </span>
                </span>
              ))}
            </div>

            <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-[#f7f8fa] px-3 py-2.5">
              <Image
                src="/figma/home/circle-check.svg"
                alt=""
                width={24}
                height={24}
              />
              <p className="text-[13px] leading-[18px] font-medium text-[#4e5968]">
                {weeklyGoal === 0
                  ? "연습 목표를 설정해 보세요"
                  : remainingGoal === 0
                    ? "이번 주 목표를 달성했어요"
                    : `${remainingGoal}일만 더 하면 이번 주 목표 달성이에요`}
              </p>
            </div>
          </section>

          <section className="mt-3 rounded-[20px] bg-white p-[18px]">
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
                className="flex size-5 items-center justify-center"
              >
                <Image
                  src="/figma/home/calendar-left.svg"
                  alt=""
                  width={20}
                  height={20}
                />
              </button>
              <h2 className="text-[15px] leading-[22px] font-bold">
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
                className="flex size-5 items-center justify-center"
              >
                <Image
                  src="/figma/home/calendar-right.svg"
                  alt=""
                  width={20}
                  height={20}
                />
              </button>
            </div>

            <div className="mt-3.5 grid grid-cols-7 gap-y-1.5 text-center">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  className="text-[11px] leading-[14px] font-medium text-[#8b95a1]"
                >
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
                  className="flex h-9 items-center justify-center"
                >
                  {cell.day == null ? null : cell.completedCount > 0 ? (
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary">
                      <Image
                        src="/figma/home/calendar-check.svg"
                        alt="연습 완료"
                        width={18}
                        height={18}
                      />
                    </span>
                  ) : (
                    <span
                      className={`flex size-8 items-center justify-center rounded-full text-xs font-medium ${
                        cell.isToday
                          ? "border-2 border-primary text-primary"
                          : "text-[#b0b8c1]"
                      }`}
                    >
                      {cell.day}
                    </span>
                  )}
                </span>
              ))}
            </div>

            <div className="mt-3.5 flex items-center gap-3 text-[11px] leading-[14px] font-medium text-[#8b95a1]">
              <span className="flex items-center gap-1">
                <span className="flex size-3.5 items-center justify-center rounded-full bg-primary">
                  <Image
                    src="/figma/home/calendar-check.svg"
                    alt=""
                    width={9}
                    height={9}
                  />
                </span>
                연습한 날
              </span>
              <span className="flex items-center gap-1">
                <span className="size-3.5 rounded-full border border-primary" />
                오늘
              </span>
            </div>

            {loading ? (
              <p className="mt-3 text-center text-xs text-[#8b95a1]">
                기록을 불러오는 중…
              </p>
            ) : error ? (
              <div
                role="alert"
                className="mt-3 text-center text-xs text-[#d91b34]"
              >
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setRetryKey((value) => value + 1)}
                  className="mt-2 min-h-11 rounded-full px-5 font-bold"
                >
                  다시 시도
                </button>
              </div>
            ) : null}
          </section>
        </div>
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
            <p className="mt-4 rounded-2xl bg-[#f7f8fa] p-4 text-sm leading-6 text-[#4e5968]">
              현재 목표는 {weeklyGoal > 0 ? `주 ${weeklyGoal}일` : "설정 전"}
              이에요. 목표 변경은 마이페이지의 연습 계획에서 할 수 있어요.
            </p>
            <a
              href="/mypage/plan"
              className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-primary font-bold text-white"
            >
              연습 계획 수정하기
            </a>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  return (
    <article className="flex min-w-0 flex-col items-center gap-3 rounded-2xl bg-white px-3 py-3.5">
      <Image src={icon} alt="" width={36} height={36} />
      <p className="text-center">
        <strong className="block text-[17px] leading-6">{value}</strong>
        <span className="mt-0.5 block whitespace-nowrap text-xs leading-4 text-[#8b95a1]">
          {label}
        </span>
      </p>
    </article>
  );
}
