"use client";

import { AppShell } from "@/components/app-shell";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  type CourseDetail,
  type HomeDashboard,
  type PracticeContentSummary,
  type Recommendation,
  type Statistics,
  type TrainingHistoryItem,
} from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { readUserClientCache, updateUserClientCache } from "@/lib/client-cache";

type RecommendationCard = Pick<
  Recommendation,
  "contentId" | "title" | "reason"
>;

type PracticeCard = {
  href: string;
  title: string;
  description: React.ReactNode;
  icon: string;
  iconWidth: number;
  iconHeight: number;
};

type HomeCache = {
  dashboard?: HomeDashboard;
  recommendations?: RecommendationCard[];
  recentCourses?: CourseDetail[];
  statistics?: Statistics;
  weekSessions?: TrainingHistoryItem[];
};

const EMPTY_DASHBOARD: HomeDashboard = {
  today: { completedCount: 0, goalCount: 0, learningSeconds: 0 },
  recommendations: [],
  recentTraining: null,
  courseProgress: null,
};

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

const PRACTICE_CARDS: PracticeCard[] = [
  {
    href: "/news",
    title: "뉴스 읽기",
    description: (
      <>
        오늘의 기사를
        <br />
        소리 내어 읽어요
      </>
    ),
    icon: "/figma/home/news.svg",
    iconWidth: 32,
    iconHeight: 36.8,
  },
  {
    href: "/sentences",
    title: "문장 연습",
    description: (
      <>
        짧은 문장을
        <br />
        반복해 교정해요
      </>
    ),
    icon: "/figma/home/sentence.svg",
    iconWidth: 38.4,
    iconHeight: 36.8,
  },
  {
    href: "/announcer",
    title: "따라 읽기",
    description: (
      <>
        아나운서 음성을
        <br />
        듣고 따라 해요
      </>
    ),
    icon: "/figma/home/follow.svg",
    iconWidth: 17.6,
    iconHeight: 36.8,
  },
  {
    href: "/my-script",
    title: "내 문장 연습",
    description: (
      <>
        발표 원고를
        <br />
        붙여넣고 연습해요
      </>
    ),
    icon: "/figma/home/custom.svg",
    iconWidth: 35.2,
    iconHeight: 33.6,
  },
];

function generalRecommendations(
  items: PracticeContentSummary[],
): RecommendationCard[] {
  return items.map((item) => ({
    contentId: item.id,
    title: item.title,
    reason: "지금 바로 시작할 수 있는 학습이에요.",
  }));
}

function combineRecommendations(
  primary: ReadonlyArray<RecommendationCard>,
  fallback: ReadonlyArray<RecommendationCard>,
) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((item) => {
    const id = String(item.contentId);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function localDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentWeekRange(today: Date) {
  const monday = new Date(today);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

export default function Home() {
  const now = useMemo(() => new Date(), []);
  const weekRange = useMemo(() => currentWeekRange(now), [now]);
  const userId = getAuthenticatedUserId();
  const cacheResource = `home-${localDateKey(weekRange.monday)}`;
  const [initialCache] = useState(() =>
    readUserClientCache<HomeCache>(userId, cacheResource),
  );
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(
    initialCache?.dashboard ?? null,
  );
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>(
    initialCache?.recommendations ?? [],
  );
  const [recentCourses, setRecentCourses] = useState<CourseDetail[]>(
    initialCache?.recentCourses ?? [],
  );
  const [statistics, setStatistics] = useState<Statistics | null>(
    initialCache?.statistics ?? null,
  );
  const [weekSessions, setWeekSessions] = useState<TrainingHistoryItem[]>(
    initialCache?.weekSessions ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const from = localDateKey(weekRange.monday);
    const to = localDateKey(weekRange.sunday);

    void Promise.allSettled([
      api.courses.getMyProgress(),
      api.myPage.getStatistics({ from, to }),
      api.myPage.listTrainingSessions({
        status: "COMPLETED",
        from,
        to,
        page: 0,
        size: 100,
      }),
    ]).then(async ([courseResult, statisticsResult, historyResult]) => {
      if (!active) return;

      if (statisticsResult.status === "fulfilled") {
        setStatistics(statisticsResult.value);
        updateUserClientCache<HomeCache>(userId, cacheResource, {
          statistics: statisticsResult.value,
        });
      }
      if (historyResult.status === "fulfilled") {
        setWeekSessions(historyResult.value.items);
        updateUserClientCache<HomeCache>(userId, cacheResource, {
          weekSessions: historyResult.value.items,
        });
      }
      if (courseResult.status !== "fulfilled") return;

      const courseResults = await Promise.allSettled(
        courseResult.value
          .filter(
            (item) => item.progressPercent > 0 && item.progressPercent < 100,
          )
          .slice(0, 2)
          .map(async (item) => {
            const course = await api.courses.get(item.courseId);
            return { ...course, progressPercent: item.progressPercent };
          }),
      );
      if (!active) return;
      const courses = courseResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      setRecentCourses(courses);
      updateUserClientCache<HomeCache>(userId, cacheResource, {
        recentCourses: courses,
      });
    });

    return () => {
      active = false;
    };
  }, [cacheResource, reloadKey, userId, weekRange]);

  useEffect(() => {
    let active = true;
    setError(null);

    void (async () => {
      const [dashboardResult, recommendationResult] = await Promise.allSettled([
        api.home.get(),
        api.home.getRecommendations({ type: "NEWS", limit: 3 }),
      ]);
      if (!active) return;

      const nextDashboard =
        dashboardResult.status === "fulfilled"
          ? dashboardResult.value
          : (initialCache?.dashboard ?? EMPTY_DASHBOARD);
      setDashboard(nextDashboard);
      if (dashboardResult.status === "fulfilled") {
        updateUserClientCache<HomeCache>(userId, cacheResource, {
          dashboard: dashboardResult.value,
        });
      }
      if (dashboardResult.status === "rejected") {
        if (!initialCache?.dashboard) {
          setError(
            dashboardResult.reason instanceof Error
              ? dashboardResult.reason.message
              : "오늘의 학습 현황을 불러오지 못했습니다.",
          );
        }
      }

      if (recommendationResult.status === "fulfilled") {
        const nextRecommendations = recommendationResult.value.slice(0, 3);
        setRecommendations(nextRecommendations);
        updateUserClientCache<HomeCache>(userId, cacheResource, {
          recommendations: nextRecommendations,
        });
      } else if (nextDashboard.recommendations.length === 0) {
        try {
          const fallback = await api.content.list({
            type: "NEWS",
            page: 0,
            size: 3,
          });
          if (active) {
            const nextRecommendations = generalRecommendations(fallback.items);
            setRecommendations(nextRecommendations);
            updateUserClientCache<HomeCache>(userId, cacheResource, {
              recommendations: nextRecommendations,
            });
          }
        } catch (reason) {
          if (active && !initialCache?.recommendations?.length) {
            setError(
              reason instanceof Error
                ? reason.message
                : "추천 학습을 불러오지 못했습니다.",
            );
          }
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [cacheResource, initialCache, reloadKey, userId]);

  const firstRecommendation = combineRecommendations(
    recommendations,
    dashboard?.recommendations ?? [],
  )[0];
  const today = dashboard?.today ?? EMPTY_DASHBOARD.today;
  const dailyDone =
    today.goalCount > 0 && today.completedCount >= today.goalCount;
  const todayHref = firstRecommendation
    ? `/practice/${firstRecommendation.contentId}?returnTo=%2Fhome&start=1`
    : "/news";
  const completedWeekdays = useMemo(
    () => new Set(weekSessions.map((item) => localDateKey(item.completedAt))),
    [weekSessions],
  );
  const weekDates = useMemo(
    () =>
      WEEKDAYS.map((label, index) => {
        const date = new Date(weekRange.monday);
        date.setDate(date.getDate() + index);
        return {
          label,
          key: localDateKey(date),
          isFuture: date > now,
        };
      }),
    [now, weekRange],
  );
  const streakDays = statistics?.consecutiveLearningDays ?? 0;

  return (
    <AppShell viewportLocked chromeColor="#2f6bff">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f2f4f6] text-[#191f28]">
        <header className="relative z-20 h-[205px] shrink-0 bg-[linear-gradient(180deg,#2f6bff_0%,#3f7bff_100%)] px-5">
          <div className="flex h-16 items-center justify-between">
            <Image
              src="/figma/home/brand-white.svg"
              alt="Speak AI"
              width={23.2}
              height={32}
              priority
            />
            <Link
              href="/home/notifications"
              aria-label="알림 보기"
              className="relative flex size-12 items-center justify-center"
            >
              <Image
                src="/figma/home/bell-white.svg"
                alt=""
                width={28}
                height={28}
              />
              <span className="absolute top-[9px] right-[4px] size-2 rounded-full border border-white bg-[#ff4d5e]" />
            </Link>
          </div>

          <section className="mt-2 h-[85px] rounded-2xl bg-white/15 px-[14px] py-[10px] text-white">
            <Link
              href="/home/streak"
              className="flex h-full items-center gap-3"
            >
              <span className="min-w-0 flex-1">
                <span className="flex h-5 items-center text-[13px] leading-[18px]">
                  연속 연습
                  <strong className="ml-1 text-sm leading-5">
                    {streakDays}일째
                  </strong>
                </span>
                <span className="mt-2 flex justify-between">
                  {weekDates.map((day) => {
                    const completed = completedWeekdays.has(day.key);
                    return (
                      <span
                        key={day.key}
                        className="flex w-5 flex-col items-center gap-[3px]"
                      >
                        <span
                          className={`flex size-5 items-center justify-center rounded-full ${
                            completed
                              ? "bg-white text-primary"
                              : "bg-white/20 text-transparent"
                          }`}
                        >
                          {completed ? (
                            <Check className="size-3.5" strokeWidth={3} />
                          ) : null}
                        </span>
                        <span
                          className={`text-[11px] leading-[14px] ${day.isFuture ? "text-white/55" : "text-white/90"}`}
                        >
                          {day.label}
                        </span>
                      </span>
                    );
                  })}
                </span>
              </span>
              <ChevronRight
                className="size-[18px] shrink-0"
                strokeWidth={2.4}
              />
            </Link>
          </section>
        </header>

        <main className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pt-4 pb-8 [-webkit-overflow-scrolling:touch]">
          {error ? (
            <div
              role="alert"
              className="mb-3 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-xs text-[#d91b34]"
            >
              <p className="min-w-0 flex-1">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="min-h-11 shrink-0 rounded-full px-3 font-bold"
              >
                다시 시도
              </button>
            </div>
          ) : null}

          <section className="relative h-[200px] overflow-hidden rounded-[20px] bg-white p-5">
            <span className="inline-flex h-[26px] items-center rounded-full bg-[#edf2ff] px-3 text-xs leading-[14px] font-bold text-primary">
              {dashboard?.courseProgress
                ? dashboard.courseProgress.title
                : "오늘의 추천"}
            </span>
            <h1 className="mt-3 text-[22px] leading-7 font-bold tracking-[-0.019em]">
              {dailyDone ? (
                <>
                  오늘 연습을 마쳤어요
                  <br />
                  내일 다시 만나요
                </>
              ) : (
                <>
                  오늘은 뉴스예요
                  <br />
                  {today.goalCount > 0
                    ? `${today.goalCount}문장이면 끝나요`
                    : "가볍게 시작해 봐요"}
                </>
              )}
            </h1>
            <Link
              href={dailyDone ? "/mypage/history" : todayHref}
              className="absolute bottom-5 left-5 z-10 flex h-12 w-[150px] items-center justify-center rounded-full bg-primary text-base leading-6 font-bold text-white active:bg-[#1f55e0]"
            >
              {dailyDone ? "기록 보기" : "시작하기"}
            </Link>
            <Image
              src="/figma/home/news-character.png"
              alt="뉴스를 읽는 Speak AI 캐릭터"
              width={185}
              height={185}
              priority
              className="absolute right-[-1px] bottom-[-37px] size-[185px] object-contain"
            />
          </section>

          <section className="mt-8">
            <h2 className="text-[17px] leading-6 font-bold tracking-[0.012em]">
              무엇을 연습할까요?
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PRACTICE_CARDS.map((card) => (
                <PracticeTile key={card.title} {...card} />
              ))}
            </div>
            <Link
              href="/lip-practice"
              className="mt-2 flex h-[76px] items-center gap-[14px] rounded-[18px] bg-white p-4 shadow-[0_2px_6px_rgba(26,33,48,0.05)]"
            >
              <Image
                src="/figma/home/lip-practice.svg"
                alt=""
                width={44}
                height={44}
                className="shrink-0"
              />
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <strong className="text-[15px] leading-[22px]">
                    입모양 보며 연습
                  </strong>
                  <span className="rounded-full bg-[#f2f4f6] px-[7px] py-0.5 text-[11px] leading-[14px] font-medium text-[#6b7684]">
                    카메라 사용
                  </span>
                </span>
                <span className="mt-[3px] block truncate text-[13px] leading-[18px] text-[#4e5968]">
                  영상으로 입모양과 소리를 함께 교정해요
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-[#b0b8c1]" />
            </Link>
          </section>

          <section className="mt-8 pb-1">
            <h2 className="text-[17px] leading-6 font-bold tracking-[0.012em]">
              진행 중인 연습
            </h2>
            <div className="mt-3 space-y-2">
              {dashboard?.recentTraining ? (
                <ContinueCard
                  href={
                    dashboard.recentTraining.status === "COMPLETED"
                      ? `/mypage/history/${dashboard.recentTraining.sessionId}`
                      : `/practice/${dashboard.recentTraining.contentId}?sessionId=${dashboard.recentTraining.sessionId}&resumeType=${dashboard.recentTraining.status === "ANALYZING" ? "ANALYSIS_STATUS" : "RECORDING"}&returnTo=%2Fhome`
                  }
                  title={dashboard.recentTraining.title}
                  detail={
                    dashboard.recentTraining.status === "COMPLETED"
                      ? "최근 완료한 연습"
                      : "멈춘 지점부터 이어서 시작해요"
                  }
                  badge="최근"
                  icon="/figma/home/progress-announcer.svg"
                  progress={
                    dashboard.recentTraining.status === "COMPLETED" ? 100 : null
                  }
                  count={
                    dashboard.recentTraining.status === "COMPLETED"
                      ? "완료"
                      : "계속"
                  }
                />
              ) : null}
              {recentCourses.map((course) => (
                <ContinueCard
                  key={String(course.id)}
                  href={`/class/${course.courseType.toLowerCase()}`}
                  title={
                    course.courseType === "INTONATION"
                      ? "억양 클래스"
                      : "발음 클래스"
                  }
                  detail={course.title}
                  icon={
                    course.courseType === "INTONATION"
                      ? "/figma/home/progress-intonation.svg"
                      : "/figma/home/progress-pronunciation.svg"
                  }
                  progress={Math.round(course.progressPercent)}
                  count={`${Math.round(course.progressPercent)}%`}
                />
              ))}
              {!dashboard?.recentTraining && recentCourses.length === 0 ? (
                <div className="flex h-[76px] items-center rounded-[18px] bg-white px-5 text-[13px] text-[#8b95a1] shadow-[0_2px_6px_rgba(26,33,48,0.05)]">
                  연습을 시작하면 이곳에서 이어갈 수 있어요.
                </div>
              ) : null}
            </div>
          </section>
        </main>
      </div>
    </AppShell>
  );
}

function PracticeTile({
  href,
  title,
  description,
  icon,
  iconWidth,
  iconHeight,
}: PracticeCard) {
  return (
    <Link
      href={href}
      className="relative flex h-[136px] min-w-0 flex-col overflow-hidden rounded-[18px] bg-white p-4 shadow-[0_2px_6px_rgba(26,33,48,0.05)] active:scale-[0.98]"
    >
      <h3 className="text-base leading-6 font-bold">{title}</h3>
      <p className="mt-1 text-[13px] leading-4 text-[#8b95a1]">{description}</p>
      <span className="absolute right-[14px] bottom-[14px] flex size-[41.6px] items-center justify-center">
        <Image src={icon} alt="" width={iconWidth} height={iconHeight} />
      </span>
    </Link>
  );
}

function ContinueCard({
  href,
  title,
  detail,
  badge,
  icon,
  progress,
  count,
}: {
  href: string;
  title: string;
  detail: string;
  badge?: string;
  icon: string;
  progress: number | null;
  count: string;
}) {
  const clampedProgress =
    progress == null ? null : Math.min(100, Math.max(0, progress));
  return (
    <Link
      href={href}
      className="flex h-[76px] items-center rounded-[18px] bg-white px-[14px] shadow-[0_2px_6px_rgba(26,33,48,0.05)]"
    >
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-full p-[3px]"
        style={{
          background:
            clampedProgress == null
              ? "#dbe5ff"
              : `conic-gradient(#2f6bff ${clampedProgress}%, #dbe5ff 0)`,
        }}
      >
        <span className="flex size-[42px] items-center justify-center rounded-full bg-white">
          <span className="flex size-[34px] items-center justify-center rounded-full bg-[#edf2ff]">
            <Image src={icon} alt="" width={28} height={28} />
          </span>
        </span>
      </span>
      <span className="ml-[14px] min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <strong className="truncate text-sm leading-5">{title}</strong>
          {badge ? (
            <span className="rounded-full bg-[#edf2ff] px-1.5 py-0.5 text-[11px] leading-[14px] font-medium text-primary">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-1 flex min-w-0 items-center text-xs leading-4">
          <strong className="mr-1 shrink-0 text-primary">다음</strong>
          <span className="truncate text-[#8b95a1]">{detail}</span>
        </span>
      </span>
      <span className="ml-3 flex shrink-0 items-center text-[13px] leading-[18px] font-medium text-[#333d4b]">
        {count}
        <ChevronRight className="ml-0.5 size-[18px] text-[#b0b8c1]" />
      </span>
    </Link>
  );
}
