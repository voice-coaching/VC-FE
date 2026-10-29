"use client";

import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./home-streak.module.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
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
const GOAL_WEEKDAYS = WEEKDAYS;

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
  from.setDate(from.getDate() - weekday);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from: dateKey(from), to: dateKey(to), monday: from };
}

export default function HomeStreak() {
  const {
    profile,
    updateLearningGoals,
    error: profileError,
    reload: reloadProfile,
  } = useProfile();
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
  const [monthSheet, setMonthSheet] = useState(false);
  const [monthDraft, setMonthDraft] = useState(visibleMonth);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [goalDraft, setGoalDraft] = useState(5);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [allSessions, setAllSessions] = useState<TrainingHistoryItem[] | null>(
    null,
  );
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    let active = true;
    setSummaryError(false);
    void (async () => {
      const result: TrainingHistoryItem[] = [];
      for (let page = 0; active; page++) {
        const history = await api.myPage.listTrainingSessions({
          status: "COMPLETED",
          page,
          size: 100,
        });
        result.push(...history.items);
        if (!(history.hasNext ?? result.length < history.totalElements)) break;
        if (!history.items.length) break;
      }
      if (active) setAllSessions(result);
    })().catch(() => {
      if (active) setSummaryError(true);
    });
    return () => {
      active = false;
    };
  }, [userId, retryKey]);

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
        allSessions ?? sessions,
        today,
      ),
    [allSessions, sessions, today, visibleMonth],
  );
  const monthCompletedDays = completedDays(calendar);
  const weeklyGoal = profile?.weeklySessions ?? 0;
  const weeklyCompletedKeys = useMemo(
    () =>
      new Set(
        (allSessions ?? weeklySessions).map((session) =>
          dateKey(new Date(session.completedAt)),
        ),
      ),
    [allSessions, weeklySessions],
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
          isToday: dateKey(date) === dateKey(today),
        };
      }),
    [currentWeek, today, weeklyCompletedKeys],
  );
  const weeklyCompleted = goalDays.filter((day) => day.completed).length;
  const consecutiveDays = statistics?.consecutiveLearningDays ?? 0;

  const historyDays = useMemo(
    () =>
      new Set(
        allSessions?.map((session) => dateKey(new Date(session.completedAt))) ??
          [],
      ),
    [allSessions],
  );
  const currentRun = useMemo(() => {
    const keys = new Set<string>();
    const date = new Date(today);
    if (!historyDays.has(dateKey(date))) date.setDate(date.getDate() - 1);
    while (historyDays.has(dateKey(date))) {
      keys.add(dateKey(date));
      date.setDate(date.getDate() - 1);
    }
    return keys;
  }, [historyDays, today]);
  const bestRun = useMemo(() => {
    let best = 0;
    let run = 0;
    let previous = "";
    for (const key of [...historyDays].sort()) {
      const date = new Date(`${key}T12:00:00`);
      date.setDate(date.getDate() - 1);
      run = dateKey(date) === previous ? run + 1 : 1;
      best = Math.max(best, run);
      previous = key;
    }
    return best;
  }, [historyDays]);
  const practicedToday = weeklyCompletedKeys.has(dateKey(today));
  const canGoForward =
    visibleMonth < new Date(today.getFullYear(), today.getMonth(), 1);
  const changeMonth = (offset: number) =>
    setVisibleMonth(
      (value) => new Date(value.getFullYear(), value.getMonth() + offset, 1),
    );
  const openGoal = () => {
    setGoalDraft(weeklyGoal || 5);
    setSaveError(null);
    setGoalSheet(true);
  };
  async function saveGoal() {
    if (!profile || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateLearningGoals({
        goalDescription: profile.goalDescription,
        minutesPerDay: profile.minutesPerDay,
        weeklySessions: goalDraft,
      });
      setGoalSheet(false);
    } catch (reason) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "목표를 저장하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      viewportLocked
      chromeColor="#f2f4f6"
      className="bg-[#f2f4f6] text-[#191f28]"
    >
      <div className="flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between px-2 py-1">
          <BackButton
            fallback="/home"
            className="flex size-10 items-center justify-start"
          >
            <StreakIcon name="back" size={24} />
          </BackButton>
          <h1 className="text-[17px] leading-6 font-bold">연속 연습</h1>
          <span className="size-10" />
        </header>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-8"
          data-scroll-container="streak"
        >
          <section className={styles.summary} aria-label="연습 요약">
            <div className="flex items-center gap-4 max-[360px]:gap-2">
              <div className={styles.avatar}>
                <div className={styles.mascotCrop}>
                  <Image
                    src="/figma/streak-improved/mascot.png"
                    alt="연습을 응원하는 Speak AI 캐릭터"
                    width={78}
                    height={84}
                    priority
                    className={styles.mascot}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[22px] leading-[30px] font-bold tracking-[-0.44px] max-[360px]:text-[18px]">
                  <span className="text-primary">
                    {allSessions ? currentRun.size : consecutiveDays}일
                  </span>{" "}
                  연속 연습 중
                </p>
                <p className="mt-0.5 text-sm leading-5 font-medium tracking-[-0.21px] text-[#8b95a1] max-[360px]:text-xs">
                  <strong className="text-primary">오늘</strong>{" "}
                  {practicedToday
                    ? "연습을 완료했어요"
                    : "연습이 아직 남았어요"}
                </p>
              </div>
            </div>
            <div className={styles.stats}>
              <SummaryStat
                icon="best"
                label="최고 기록"
                value={allSessions ? `${bestRun}일` : "—"}
              />
              <SummaryStat
                icon="total"
                label="총 연습"
                value={allSessions ? `${historyDays.size}일` : "—"}
              />
              <SummaryStat
                icon="month"
                label={
                  visibleMonth.getMonth() === today.getMonth() &&
                  visibleMonth.getFullYear() === today.getFullYear()
                    ? "이번 달"
                    : `${visibleMonth.getMonth() + 1}월`
                }
                value={loading || error ? "—" : `${monthCompletedDays}일`}
              />
            </div>
            {summaryError ? (
              <button
                className="text-xs text-[#6b7684]"
                onClick={() => setRetryKey((value) => value + 1)}
              >
                전체 기록 다시 불러오기
              </button>
            ) : null}
          </section>

          <section
            className="mt-3 rounded-[20px] bg-white p-5"
            aria-labelledby="week-title"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="week-title"
                  className="text-[17px] leading-6 font-bold tracking-[-0.255px]"
                >
                  이번 주 목표
                </h2>
                <p className="mt-0.5 flex items-baseline gap-0.5">
                  <strong className="text-[26px] leading-[34px] tracking-[-0.52px] text-primary">
                    {weeklyCompleted}
                  </strong>
                  <span className="text-[15px] leading-[22px] font-medium text-[#8b95a1]">
                    {weeklyGoal ? `/ ${weeklyGoal}일` : "일 연습"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={openGoal}
                aria-label="주간 연습 목표 변경"
                className="flex items-center gap-0.5 rounded-full bg-[#f2f4f6] py-1.5 pr-1.5 pl-2.5 text-[13px] leading-[18px] font-medium text-[#4e5968]"
              >
                {weeklyGoal ? `주 ${weeklyGoal}일` : "목표 설정"}
                <StreakIcon name="goal-chevron" size={14} />
              </button>
            </div>
            <div className="mt-5 flex justify-between">
              {goalDays.map((day) => (
                <div
                  key={day.label}
                  className="flex min-w-0 flex-col items-center gap-1.5"
                >
                  <span
                    aria-label={`${day.label}요일${day.completed ? ", 연습 완료" : ""}${day.isToday ? ", 오늘" : ""}`}
                    className={`${styles.weekDot} ${day.completed ? styles.completed : day.isToday ? styles.today : ""}`}
                  >
                    {day.completed ? (
                      <StreakIcon name="check" size={21} />
                    ) : day.isToday ? (
                      today.getDate()
                    ) : null}
                  </span>
                  <span
                    className={`text-xs leading-4 ${day.isToday ? "font-bold text-primary" : day.isFuture ? "text-[#b0b8c1]" : "text-[#4e5968]"}`}
                  >
                    {day.isToday ? "오늘" : day.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section
            className="mt-3 rounded-[20px] bg-white p-5"
            aria-label="연습 달력"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="월 선택"
                onClick={() => {
                  setMonthDraft(visibleMonth);
                  setPickerYear(visibleMonth.getFullYear());
                  setMonthSheet(true);
                }}
                className="flex items-center gap-1 text-[17px] leading-6 font-bold tracking-[-0.255px]"
              >
                {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
                <StreakIcon
                  name="month-chevron"
                  size={16}
                  className="rotate-90"
                />
              </button>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="이전 달"
                  onClick={() => changeMonth(-1)}
                  className={styles.monthArrow}
                >
                  <StreakIcon name="previous" size={16} />
                </button>
                <button
                  type="button"
                  aria-label="다음 달"
                  disabled={!canGoForward}
                  onClick={() => changeMonth(1)}
                  className={styles.monthArrow}
                >
                  <StreakIcon name="next" size={16} />
                </button>
              </div>
            </div>
            <div className="mt-3.5 grid grid-cols-7 text-center">
              {WEEKDAYS.map((day, index) => (
                <span
                  key={day}
                  className={`text-xs leading-4 font-medium ${index === 0 ? "text-[#f04452]" : "text-[#8b95a1]"}`}
                >
                  {day}
                </span>
              ))}
            </div>
            <div className={styles.calendar}>
              {calendar.map((cell, index) => {
                const kind = cell.completedCount
                  ? currentRun.has(cell.key)
                    ? "current"
                    : "past"
                  : "none";
                const sameKind = (at: number) => {
                  const neighbor = calendar[at];
                  return (
                    neighbor?.completedCount &&
                    (currentRun.has(neighbor.key) ? "current" : "past") === kind
                  );
                };
                const start = index % 7 === 0 || !sameKind(index - 1);
                const end = index % 7 === 6 || !sameKind(index + 1);
                return (
                  <div
                    key={cell.key}
                    className={styles.calendarCell}
                    aria-label={
                      cell.day
                        ? `${visibleMonth.getMonth() + 1}월 ${cell.day}일, ${cell.completedCount}회 연습${cell.isToday ? ", 오늘" : ""}`
                        : undefined
                    }
                  >
                    {cell.day ? (
                      <>
                        {kind !== "none" ? (
                          <span
                            aria-hidden="true"
                            className={`${styles.run} ${kind === "current" ? styles.currentRun : styles.pastRun} ${start ? styles.runStart : ""} ${end ? styles.runEnd : ""}`}
                          />
                        ) : null}
                        <span
                          className={`${styles.date} ${kind === "current" ? "font-bold text-white" : kind === "past" || cell.isToday ? "font-bold text-primary" : cell.key > dateKey(today) ? "text-[#c4cad1]" : "text-[#4e5968]"} ${cell.isToday ? styles.todayDate : ""}`}
                        >
                          {cell.isToday ? (
                            <StreakIcon
                              name="today"
                              size={34}
                              className="absolute inset-0"
                            />
                          ) : null}
                          {cell.day}
                        </span>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-3.5 flex items-center gap-3.5 text-[11px] leading-4 text-[#6b7684]">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-full bg-primary" />
                현재 연속
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-full bg-[#eaf0ff]" />
                연습한 날
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-full border-[1.5px] border-primary" />
                오늘
              </span>
            </div>
            {loading ? (
              <p
                role="status"
                className="mt-3 text-center text-xs text-[#8b95a1]"
              >
                기록을 불러오는 중…
              </p>
            ) : error ? (
              <div
                role="alert"
                className="mt-3 text-center text-xs text-[#d91b34]"
              >
                <p>{error}</p>
                <button
                  onClick={() => setRetryKey((value) => value + 1)}
                  className="mt-2 min-h-11 px-5 font-bold"
                >
                  다시 시도
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <Dialog.Root open={monthSheet} onOpenChange={setMonthSheet}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            className={`${styles.sheet} ${styles.monthSheet}`}
            aria-describedby={undefined}
          >
            <span className={styles.grab} />
            <Dialog.Title className="sr-only">연습 기록 월 선택</Dialog.Title>
            <div className="mt-[38px] flex h-[22px] items-center justify-between">
              <button
                aria-label="이전 연도"
                onClick={() => setPickerYear((year) => year - 1)}
              >
                <StreakIcon name="year-previous" size={20} />
              </button>
              <strong className="text-[15px] leading-[22px]">
                {pickerYear}년
              </strong>
              <button
                aria-label="다음 연도"
                disabled={pickerYear >= today.getFullYear()}
                onClick={() => setPickerYear((year) => year + 1)}
                className="disabled:opacity-40"
              >
                <StreakIcon name="year-next" size={20} />
              </button>
            </div>
            <div className="mt-3.5 grid grid-cols-4 gap-2.5">
              {Array.from({ length: 12 }, (_, month) => {
                const disabled = new Date(pickerYear, month, 1) > today;
                const selected =
                  monthDraft.getFullYear() === pickerYear &&
                  monthDraft.getMonth() === month;
                return (
                  <button
                    key={month}
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() =>
                      setMonthDraft(new Date(pickerYear, month, 1))
                    }
                    className={`${styles.monthOption} ${selected ? styles.selectedMonth : ""}`}
                  >
                    {month + 1}월
                  </button>
                );
              })}
            </div>
            <button
              className={`${styles.action} mt-5`}
              onClick={() => {
                setVisibleMonth(monthDraft);
                setMonthSheet(false);
              }}
            >
              {monthDraft.getFullYear()}년 {monthDraft.getMonth() + 1}월 보기
            </button>
            <Dialog.Close className="sr-only">닫기</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={goalSheet}
        onOpenChange={(open) => {
          if (!saving) setGoalSheet(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.sheet}>
            <span className={styles.grab} />
            <Dialog.Title className="mt-5 text-xl leading-7 font-bold tracking-[-0.3px]">
              일주일에 며칠 연습할까요?
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] leading-[18px] font-medium tracking-[-0.195px] text-[#8b95a1]">
              목표를 바꿔도 연속 기록은 그대로 이어져요
            </Dialog.Description>
            <div
              className="mt-[22px] flex gap-1.5"
              role="group"
              aria-label="주간 연습 일수"
            >
              {Array.from({ length: 7 }, (_, index) => index + 1).map(
                (days) => (
                  <button
                    key={days}
                    disabled={saving}
                    aria-pressed={goalDraft === days}
                    aria-label={`주 ${days}일`}
                    onClick={() => setGoalDraft(days)}
                    className={`${styles.goalOption} ${goalDraft === days ? styles.completed : ""}`}
                  >
                    <strong className="text-lg leading-6">{days}</strong>
                    <span className="text-xs leading-4 opacity-60">일</span>
                  </button>
                ),
              )}
            </div>
            {saveError || profileError ? (
              <p role="alert" className="mt-3 text-xs text-[#d91b34]">
                {saveError ?? profileError}
              </p>
            ) : null}
            {!profile && profileError ? (
              <button
                onClick={reloadProfile}
                className="mt-3 text-sm text-primary"
              >
                목표 다시 불러오기
              </button>
            ) : null}
            <button
              disabled={saving || !profile}
              className={`${styles.action} mt-[33px]`}
              onClick={saveGoal}
            >
              {saving ? "저장 중…" : `주 ${goalDraft}일로 저장`}
            </button>
            <Dialog.Close disabled={saving} className="sr-only">
              닫기
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}

function StreakIcon({
  name,
  size,
  className = "",
}: {
  name: string;
  size: number;
  className?: string;
}) {
  return (
    <Image
      src={`/figma/streak-improved/${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    />
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="flex items-center gap-1 text-xs leading-4 font-medium tracking-[-0.18px] text-[#8b95a1]">
        <span className="flex size-4 items-center justify-center">
          <Image
            src={`/figma/streak-improved/${icon}.svg`}
            alt=""
            width={icon === "total" ? 16.2652 : icon === "month" ? 13.5243 : 16}
            height={icon === "total" ? 16.0243 : 16}
          />
        </span>
        {label}
      </span>
      <strong className="text-lg leading-[26px] tracking-[-0.27px]">
        {value}
      </strong>
    </div>
  );
}
