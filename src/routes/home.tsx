"use client";

import { SkeletonBlock } from "@/components/skeleton-block";
import { AppShell } from "@/components/app-shell";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import styles from "./home.module.css";
import { newsHeadline } from "@/lib/news-presentation";
import {
  updateHomeHeader,
  type HeaderScrollState,
} from "@/lib/home-header-scroll";

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
    icon: "/figma/home-before/practice-news.svg",
    iconWidth: 32.0002,
    iconHeight: 36.8005,
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
    icon: "/figma/home-before/practice-sentence.svg",
    iconWidth: 38.7998,
    iconHeight: 37.2006,
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
    icon: "/figma/home-before/practice-follow.svg",
    iconWidth: 20,
    iconHeight: 41.0008,
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
    icon: "/figma/home-before/practice-custom.svg",
    iconWidth: 35.2005,
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
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const headerScroll = useRef<HeaderScrollState>({
    top: 0,
    travel: 0,
    hidden: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [statisticsLoading, setStatisticsLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsItems, setNewsItems] = useState<PracticeContentSummary[]>([]);
  const [newsFailed, setNewsFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setNewsLoading(true);
    setNewsFailed(false);
    void api.content
      .list({ type: "NEWS", page: 0, size: 5 })
      .then((result) => {
        if (active) setNewsItems(result.items.slice(0, 5));
      })
      .catch(() => {
        if (active) setNewsFailed(true);
      })
      .finally(() => {
        if (active) setNewsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  const [coursesUnavailable, setCoursesUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const from = localDateKey(weekRange.monday);
    const to = localDateKey(weekRange.sunday);
    setCoursesLoading(true);
    setStatisticsLoading(true);
    setCoursesUnavailable(false);

    void api.myPage
      .getStatistics({ from, to })
      .then((value) => {
        if (!active) return;
        setStatistics(value);
        updateUserClientCache<HomeCache>(userId, cacheResource, {
          statistics: value,
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setStatisticsLoading(false);
      });
    void api.myPage
      .listTrainingSessions({
        status: "COMPLETED",
        from,
        to,
        page: 0,
        size: 100,
      })
      .then((value) => {
        if (!active) return;
        setWeekSessions(value.items);
        updateUserClientCache<HomeCache>(userId, cacheResource, {
          weekSessions: value.items,
        });
      })
      .catch(() => undefined);
    void api.courses
      .getMyProgress("IN_PROGRESS")
      .then(async (progress) => {
        if (!active) return;
        const courseResults = await Promise.allSettled(
          progress
            .filter((item) => item.status === "IN_PROGRESS")
            .slice(0, 2)
            .map(async (item) => {
              const course = await api.courses.get(item.courseId);
              return {
                ...course,
                progressPercent: item.progressPercent,
                progress: {
                  ...course.progress,
                  status: item.status,
                  progressPercent: item.progressPercent,
                },
              };
            }),
        );
        if (!active) return;
        const courses = courseResults.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        setRecentCourses(courses);
        setCoursesUnavailable(
          courseResults.some((result) => result.status === "rejected"),
        );
        updateUserClientCache<HomeCache>(userId, cacheResource, {
          recentCourses: courses,
        });
      })
      .catch(() => {
        if (active) setCoursesUnavailable(true);
      })
      .finally(() => {
        if (active) setCoursesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cacheResource, reloadKey, userId, weekRange]);

  useEffect(() => {
    let active = true;
    setError(null);
    setDashboardLoading(true);

    const dashboardRequest = api.home.get();
    void dashboardRequest
      .then((value) => {
        if (!active) return;
        setDashboard(value);
        updateUserClientCache<HomeCache>(userId, cacheResource, {
          dashboard: value,
        });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (!initialCache?.dashboard) {
          setDashboard(EMPTY_DASHBOARD);
          setError(
            reason instanceof Error
              ? reason.message
              : "오늘의 학습 현황을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (active) setDashboardLoading(false);
      });

    void api.home
      .getRecommendations({ type: "NEWS", limit: 3 })
      .then((value) => {
        if (!active) return;
        const nextRecommendations = value.slice(0, 3);
        setRecommendations(nextRecommendations);
        updateUserClientCache<HomeCache>(userId, cacheResource, {
          recommendations: nextRecommendations,
        });
      })
      .catch(async () => {
        try {
          const nextDashboard = await dashboardRequest.catch(() => null);
          if (!active || nextDashboard?.recommendations.length) return;
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
      });

    return () => {
      active = false;
    };
  }, [cacheResource, initialCache, reloadKey, userId]);

  useEffect(() => {
    let active = true;
    api.notifications
      .list({ page: 0, size: 1, unreadOnly: true })
      .then((result) => {
        if (active) {
          setHasUnreadNotifications(
            result.unreadCount > 0 && result.items.length > 0,
          );
        }
      })
      .catch(() => {
        if (active) setHasUnreadNotifications(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

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
          isToday: localDateKey(date) === localDateKey(now),
          isFuture: date > now,
        };
      }),
    [now, weekRange],
  );
  const streakDays = statistics?.consecutiveLearningDays ?? 0;
  const recentTraining = dashboard?.recentTraining;
  const ongoingTraining =
    recentTraining &&
    ["RECORDING", "UPLOADING", "ANALYZING"].includes(recentTraining.status)
      ? recentTraining
      : null;
  const ongoingCourses = recentCourses.filter(
    (course) => course.progress?.status === "IN_PROGRESS",
  );
  return (
    <AppShell
      animateRoute={false}
      viewportLocked
      className="relative"
      chromeColor={headerCollapsed ? "#f2f4f6" : "#2f6bff"}
    >
      <header
        className={`${styles.homeHeader} z-20`}
        data-state={headerCollapsed ? "hidden" : "visible"}
        inert={headerCollapsed}
      >
        <div className="flex h-16 items-center px-5">
          <Image
            src="/figma/home-before/brand.svg"
            alt="Speak AI"
            width={23.2}
            height={32}
            priority
          />
          <span className="min-w-0 flex-1" />
          <Link
            href="/home/notifications"
            aria-label="알림 보기"
            className="relative flex size-11 items-center justify-end"
          >
            <Image
              src="/figma/home-before/bell.svg"
              alt=""
              width={28}
              height={28}
            />
            {hasUnreadNotifications ? (
              <Image
                src="/figma/home-before/badge-dot.svg"
                alt=""
                width={8}
                height={8}
                className="absolute top-[9px] right-0"
              />
            ) : null}
          </Link>
        </div>

        <section className="mx-5 mt-1 h-[95px] rounded-[20px] border border-white/45 bg-linear-[169deg,rgba(255,255,255,0.24)_14.286%,rgba(255,255,255,0.08)_85.714%] py-[14px] pr-[14px] pl-4 text-white">
          <Link href="/home/streak" className="flex h-full items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[13px] leading-[18px] font-medium tracking-[0.2522px]">
                  연속 연습
                </span>
                <strong className="text-sm leading-5 tracking-[0.203px]">
                  {statistics
                    ? `${streakDays}일째`
                    : statisticsLoading
                      ? "불러오는 중"
                      : "—"}
                </strong>
              </span>
              <span className="mt-2 flex justify-between">
                {weekDates.map((day) => {
                  const completed = completedWeekdays.has(day.key);
                  const dot = completed
                    ? "/figma/home-before/day-complete-dot.svg"
                    : day.isToday
                      ? "/figma/home-before/day-current.svg"
                      : "/figma/home-before/day-inactive.svg";
                  return (
                    <span
                      key={day.key}
                      className="flex w-5 flex-col items-center gap-[3px]"
                    >
                      <span className="relative size-5">
                        <Image src={dot} alt="" width={20} height={20} />
                        {completed ? (
                          <Image
                            src="/figma/home-before/day-check.svg"
                            alt=""
                            width={14}
                            height={14}
                            className="absolute top-[3px] left-[3px]"
                          />
                        ) : null}
                      </span>
                      <span
                        className={`text-[11px] leading-[14px] tracking-[0.3421px] ${
                          day.isToday
                            ? "font-bold text-white"
                            : day.isFuture
                              ? "font-medium text-white/55"
                              : "font-medium text-white/75"
                        }`}
                      >
                        {day.label}
                      </span>
                    </span>
                  );
                })}
              </span>
            </span>
            <Image
              src="/figma/home-before/chevron-streak.svg"
              alt=""
              width={18}
              height={18}
              className="shrink-0"
            />
          </Link>
        </section>
      </header>
      <div
        data-scroll-container="home"
        onScroll={(event) => {
          const element = event.currentTarget;
          const next = updateHomeHeader(
            headerScroll.current,
            element.scrollTop,
            element.scrollHeight - element.clientHeight,
          );
          headerScroll.current = next;
          setHeaderCollapsed(next.hidden);
        }}
        className="relative h-full min-h-0 overflow-y-auto overscroll-y-contain bg-[#f2f4f6] text-[#191f28] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="h-[187px] shrink-0" aria-hidden="true" />

        <main className="relative z-10 bg-[#f2f4f6]">
          <div className="relative pb-8">
            <div className="relative px-5 pt-6">
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

              {dashboardLoading && !dashboard ? (
                <div role="status" aria-label="오늘의 학습 불러오는 중">
                  <SkeletonBlock className="h-[200px] w-full rounded-[20px] bg-[#e5e8eb]" />
                </div>
              ) : (
                <section
                  className={`${styles.todayCard} relative h-[200px] overflow-hidden rounded-[20px] p-5`}
                >
                  <span className="inline-flex h-[26px] items-center rounded-full pr-3 pl-0.5 text-[11px] leading-[14px] font-bold tracking-[0.3421px] text-primary">
                    {dashboard?.courseProgress
                      ? dashboard.courseProgress.title
                      : "오늘의 추천"}
                  </span>
                  <h1 className="mt-3 text-xl leading-7 font-bold tracking-[-0.24px]">
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
                  <span className="absolute right-4 bottom-[-37px] h-[185px] w-[154px] overflow-hidden">
                    <Image
                      src="/figma/home/news-character.png"
                      unoptimized
                      alt="뉴스를 읽는 Speak AI 캐릭터"
                      width={217}
                      height={216}
                      priority
                      className="absolute top-[-8.21%] left-[-20.36%] h-[116.76%] w-[140.85%] max-w-none"
                    />
                  </span>
                </section>
              )}

              <HomeNewsTicker
                items={newsItems}
                failed={newsFailed}
                loading={newsLoading}
              />

              <section className="mt-7">
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
                  className={`${styles.lipCard} mt-2 flex h-[76px] items-center gap-[14px] rounded-[18px] p-4 shadow-[0_2px_6px_rgba(26,33,48,0.05)]`}
                >
                  <Image
                    src="/figma/home-before/lip-practice.svg"
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
                      <span className="shrink-0 rounded-full bg-white/85 px-[7px] py-0.5 text-[11px] leading-[14px] font-medium text-[#6b7684] max-[360px]:hidden">
                        카메라 사용
                      </span>
                    </span>
                    <span className="mt-[3px] block truncate text-[13px] leading-[18px] text-[#4e5968]">
                      영상으로 입모양과 소리를 함께 교정해요
                    </span>
                  </span>
                  <Image
                    src="/figma/home-before/chevron-feature.svg"
                    alt=""
                    width={20}
                    height={20}
                    className="shrink-0"
                  />
                </Link>
              </section>

              <section className="mt-7">
                <h2 className="text-[17px] leading-6 font-bold tracking-[0.012em]">
                  진행 중인 연습
                </h2>
                <div className="mt-3 space-y-2">
                  {ongoingTraining ? (
                    <ContinueCard
                      href={`/practice/${ongoingTraining.contentId}?sessionId=${ongoingTraining.sessionId}&resumeType=${ongoingTraining.status === "ANALYZING" ? "ANALYSIS_STATUS" : "RECORDING"}&returnTo=%2Fhome`}
                      title={ongoingTraining.title}
                      detail="멈춘 지점부터 이어서 시작해요"
                      badge="최근"
                      ring="/figma/home-before/progress-announcer-ring.svg"
                      icon="/figma/home-before/progress-announcer.svg"
                      iconWidth={10.4626}
                      iconHeight={23.5385}
                      badgeColor="#eaf0ff"
                      count="계속"
                    />
                  ) : null}
                  {ongoingCourses.map((course) => (
                    <ContinueCard
                      key={String(course.id)}
                      href={`/class/${course.courseType.toLowerCase()}`}
                      title={
                        course.courseType === "INTONATION"
                          ? "억양 클래스"
                          : "발음 클래스"
                      }
                      detail={course.title}
                      ring={
                        course.courseType === "INTONATION"
                          ? "/figma/home-before/progress-intonation-ring.svg"
                          : "/figma/home-before/progress-pronunciation-ring.svg"
                      }
                      icon={
                        course.courseType === "INTONATION"
                          ? "/figma/home-before/progress-intonation.svg"
                          : "/figma/home-before/progress-pronunciation.svg"
                      }
                      iconWidth={
                        course.courseType === "INTONATION" ? 28.3341 : 20.7783
                      }
                      iconHeight={
                        course.courseType === "INTONATION" ? 17.0023 : 17.0005
                      }
                      badgeColor="#eaf0ff"
                      chevron={
                        course.courseType === "INTONATION"
                          ? "/figma/home-before/chevron-intonation.svg"
                          : undefined
                      }
                      count={`${Math.round(course.progressPercent)}%`}
                    />
                  ))}
                  {!ongoingTraining && ongoingCourses.length === 0 ? (
                    <div
                      className="rounded-[18px] bg-white px-5 py-6 text-center text-sm leading-6 text-[#6b7684]"
                      role="status"
                    >
                      {error || coursesUnavailable ? (
                        <>
                          <p>진행 중인 연습을 확인하지 못했어요.</p>
                          <button
                            type="button"
                            onClick={() => setReloadKey((value) => value + 1)}
                            className="mt-2 min-h-11 rounded-full px-4 font-bold text-primary"
                          >
                            다시 확인
                          </button>
                        </>
                      ) : !dashboard || coursesLoading ? (
                        <p>진행 중인 연습을 불러오고 있어요.</p>
                      ) : (
                        <>
                          <p>진행 중인 연습이 없어요.</p>
                          <p className="mt-1">
                            위에서 원하는 연습을 시작해 보세요.
                          </p>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </AppShell>
  );
}

function HomeNewsTicker({
  items,
  failed,
  loading,
}: {
  items: PracticeContentSummary[];
  failed: boolean;
  loading: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const tickerRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduceMotion(media.matches);
    const syncVisibility = () => setPageVisible(!document.hidden);
    syncMotion();
    syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.5 },
    );
    if (tickerRef.current) observer.observe(tickerRef.current);
    return () => {
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
      observer.disconnect();
    };
  }, []);

  // Give each headline a full reading interval, including after interaction.
  useEffect(() => {
    if (
      items.length < 2 ||
      hovered ||
      focused ||
      transitioning ||
      !inView ||
      !pageVisible ||
      reduceMotion
    )
      return;
    const timer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % items.length);
      setTransitioning(true);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [
    items.length,
    index,
    hovered,
    focused,
    transitioning,
    inView,
    pageVisible,
    reduceMotion,
  ]);

  useEffect(() => {
    if (!transitioning) return;
    const timer = window.setTimeout(
      () => setTransitioning(false),
      reduceMotion ? 0 : 560,
    );
    return () => window.clearTimeout(timer);
  }, [transitioning, reduceMotion]);

  const item = items[index];
  const previousIndex = (index - 1 + items.length) % items.length;
  const previousItem = items[previousIndex];
  return (
    <Link
      href={item ? `/practice/${item.id}?returnTo=%2Fhome` : "/news"}
      aria-busy={loading}
      aria-label={
        item
          ? `인기 뉴스 ${index + 1}위: ${newsHeadline(item.title)}`
          : "뉴스 읽기 보기"
      }
      ref={tickerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="mt-7 flex h-14 items-center gap-2.5 overflow-hidden rounded-[16px] bg-white py-4 pr-3 pl-[14px] shadow-[0_2px_8px_rgba(26,51,128,0.05)]"
    >
      <span className="shrink-0 rounded-[6px] bg-[#eaf0ff] px-2 py-[3px] text-[11px] leading-4 font-bold tracking-[-0.165px] text-primary">
        인기 뉴스
      </span>
      <span className={styles.newsWindow} aria-hidden="true">
        {transitioning && previousItem ? (
          <span
            className={`${styles.newsRow} ${styles.newsOutgoing}`}
            key={`out-${previousItem.id}`}
          >
            <strong className={styles.newsRank}>{previousIndex + 1}</strong>
            <span className={styles.newsTitle}>
              {newsHeadline(previousItem.title)}
            </span>
          </span>
        ) : null}
        <span
          className={`${styles.newsRow} ${transitioning ? styles.newsIncoming : ""}`}
          key={item?.id ?? "empty"}
        >
          {item ? (
            <strong className={styles.newsRank}>{index + 1}</strong>
          ) : null}
          <span className={styles.newsTitle}>
            {(item ? newsHeadline(item.title) : null) ??
              (failed
                ? "뉴스 목록에서 다시 확인해 주세요"
                : loading
                  ? "뉴스를 불러오고 있어요"
                  : "새로운 뉴스를 준비하고 있어요")}
          </span>
        </span>
      </span>
      <Image
        src="/figma/home-before/chevron-news.svg"
        alt=""
        width={16}
        height={16}
        className="shrink-0"
      />
    </Link>
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
      className={`${styles.practiceTile} relative flex h-[136px] min-w-0 flex-col overflow-hidden rounded-[18px] p-4 active:scale-[0.98]`}
    >
      <h3 className="text-[17px] leading-6 font-bold">{title}</h3>
      <p className="mt-1 text-xs leading-4 tracking-[0.3024px] text-[#6b7684]">
        {description}
      </p>
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
  ring,
  icon,
  iconWidth,
  iconHeight,
  badgeColor,
  chevron = "/figma/home-before/chevron-progress.svg",
  count,
}: {
  href: string;
  title: string;
  detail: string;
  badge?: string;
  ring: string;
  icon: string;
  iconWidth: number;
  iconHeight: number;
  badgeColor: string;
  chevron?: string;
  count: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-[76px] items-center gap-[14px] rounded-[18px] bg-white py-[14px] pr-3 pl-[14px] shadow-[0_2px_3px_rgba(26,33,48,0.05)]"
    >
      <span className="relative size-12 shrink-0">
        <Image src={ring} alt="" width={48} height={48} />
        <span
          className="absolute top-[7px] left-[7px] flex size-[34px] items-center justify-center overflow-hidden rounded-[17px]"
          style={{ backgroundColor: badgeColor }}
        >
          <Image src={icon} alt="" width={iconWidth} height={iconHeight} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <strong className="truncate text-sm leading-5">{title}</strong>
          {badge ? (
            <span className="shrink-0 rounded-full bg-[#edf2ff] px-1.5 py-0.5 text-[11px] leading-[14px] font-bold tracking-[0.3421px] text-primary">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-1 flex min-w-0 items-center text-xs leading-4 tracking-[0.3024px]">
          <strong className="mr-1 shrink-0 text-primary">다음</strong>
          <span className="truncate text-[#6b7684]">{detail}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[13px] leading-[18px] font-bold tracking-[0.2522px] text-[#191f28]">
        {count}
        <Image src={chevron} alt="" width={18} height={18} />
      </span>
    </Link>
  );
}
