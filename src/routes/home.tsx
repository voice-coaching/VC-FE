"use client";
import { AppShell } from "@/components/app-shell";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type UIEvent } from "react";
import {
  api,
  type HomeDashboard,
  type PracticeContentSummary,
  type Recommendation,
  type CourseDetail,
} from "@/lib/api";

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
  badgeClassName: string;
};

const EMPTY_DASHBOARD: HomeDashboard = {
  today: { completedCount: 0, goalCount: 0, learningSeconds: 0 },
  recommendations: [],
  recentTraining: null,
  courseProgress: null,
};

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
    iconWidth: 23.31,
    iconHeight: 28.31,
    badgeClassName: "bg-[#a5e8ff]",
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
    iconWidth: 26.54,
    iconHeight: 25.27,
    badgeClassName: "bg-[#aeebb4]",
  },
  {
    href: "/announcer",
    title: "따라 읽기",
    description: (
      <>
        아나운서의
        <br />
        음성을 듣고 따라 해요
      </>
    ),
    icon: "/figma/home/follow.svg",
    iconWidth: 14.15,
    iconHeight: 31.85,
    badgeClassName: "bg-[#bfceff]",
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
    iconWidth: 24.77,
    iconHeight: 23.97,
    badgeClassName: "bg-[#c9bbff]",
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

export default function Home() {
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>(
    [],
  );
  const [recentCourses, setRecentCourses] = useState<CourseDetail[]>([]);
  useEffect(() => {
    let active = true;
    api.courses
      .getMyProgress()
      .then((items) =>
        Promise.all(
          items
            .filter(
              (item) => item.progressPercent > 0 && item.progressPercent < 100,
            )
            .slice(0, 2)
            .map(async (item) => {
              const course = await api.courses.get(item.courseId);
              return { ...course, progressPercent: item.progressPercent };
            }),
        ),
      )
      .then((items) => {
        if (active) setRecentCourses(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerVisibleRef = useRef(true);
  const previousScrollTop = useRef(0);
  const scrollDirection = useRef<"up" | "down" | null>(null);
  const directionalDistance = useRef(0);

  function updateHeaderVisibility(visible: boolean) {
    if (headerVisibleRef.current === visible) return;
    headerVisibleRef.current = visible;
    setHeaderVisible(visible);
  }

  function handleHomeScroll(event: UIEvent<HTMLDivElement>) {
    const scrollTop = Math.max(0, event.currentTarget.scrollTop);
    const delta = scrollTop - previousScrollTop.current;
    previousScrollTop.current = scrollTop;

    if (scrollTop <= 12) {
      scrollDirection.current = null;
      directionalDistance.current = 0;
      updateHeaderVisibility(true);
      return;
    }
    if (Math.abs(delta) < 1) return;

    const nextDirection = delta > 0 ? "down" : "up";
    if (scrollDirection.current !== nextDirection) {
      scrollDirection.current = nextDirection;
      directionalDistance.current = 0;
    }
    directionalDistance.current += Math.abs(delta);

    const threshold = nextDirection === "down" ? 24 : 10;
    if (directionalDistance.current < threshold) return;

    updateHeaderVisibility(nextDirection === "up");
    directionalDistance.current = 0;
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const [dashboardResult, recommendationResult] = await Promise.allSettled([
        api.home.get(),
        api.home.getRecommendations({ type: "NEWS", limit: 3 }),
      ]);
      if (!active) return;

      const nextDashboard =
        dashboardResult.status === "fulfilled"
          ? dashboardResult.value
          : EMPTY_DASHBOARD;
      setDashboard(nextDashboard);
      if (dashboardResult.status === "rejected") {
        setError(
          dashboardResult.reason instanceof Error
            ? dashboardResult.reason.message
            : "오늘의 학습 현황을 불러오지 못했습니다.",
        );
      }

      if (recommendationResult.status === "fulfilled") {
        setRecommendations(recommendationResult.value.slice(0, 3));
      } else if (nextDashboard.recommendations.length === 0) {
        try {
          const fallback = await api.content.list({
            type: "NEWS",
            page: 0,
            size: 3,
          });
          if (active)
            setRecommendations(generalRecommendations(fallback.items));
        } catch (reason) {
          if (active) {
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
  }, []);

  const firstRecommendation = combineRecommendations(
    recommendations,
    dashboard?.recommendations ?? [],
  )[0];
  const today = dashboard?.today ?? EMPTY_DASHBOARD.today;
  const dailyDone =
    today.goalCount > 0 && today.completedCount >= today.goalCount;
  const todayHref = firstRecommendation
    ? `/practice/${firstRecommendation.contentId}?returnTo=%2Fhome`
    : "/news";

  return (
    <AppShell viewportLocked>
      <div className="relative flex h-full min-h-0 flex-col bg-[#f5f6f8] text-[#191f28]">
        <header
          data-state={headerVisible ? "visible" : "hidden"}
          aria-hidden={!headerVisible}
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex h-16 items-center bg-[#f5f6f8] px-5 py-3 transition-[opacity,transform] duration-200 ease-out will-change-transform motion-reduce:transition-none ${
            headerVisible
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0"
          }`}
        >
          <Image
            src="/figma/home/logo.svg"
            alt="SpeakAI"
            width={30}
            height={25}
            priority
          />
        </header>

        <div
          data-scroll-container="home"
          onScroll={handleHomeScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pt-16 pb-[26px] [-webkit-overflow-scrolling:touch]"
        >
          {error ? (
            <p
              role="alert"
              className="mb-3 rounded-xl bg-[#fff0f0] px-4 py-3 text-xs text-[#d91b34]"
            >
              {error}
            </p>
          ) : null}

          <section className="h-[360px] overflow-hidden rounded-[20px] bg-white px-5 pt-6 pb-5 shadow-[0_2px_8px_rgba(26,33,48,0.06)]">
            <p className="inline-flex h-[26px] items-center rounded-full bg-[#edf2ff] px-3 text-[11px] leading-[14px] font-bold tracking-[0.034em] text-[#2f6bff]">
              오늘 {today.completedCount}/{today.goalCount}회 완료
            </p>

            <h1 className="mt-3.5 text-[22px] leading-[30px] font-bold tracking-[-0.0194em]">
              {dailyDone ? "오늘의 연습을 마쳤어요" : "오늘은 뉴스 읽기예요"}
              <br />
              {dailyDone
                ? "조금씩 꾸준히, 잘하고 있어요"
                : "추천 문장으로 연습해요"}
            </h1>

            <div className="mt-[18px] flex h-[124px] items-center justify-center">
              <div className="flex size-[124px] items-center justify-center overflow-hidden rounded-[36px] bg-[#a5e8ff]">
                <Image
                  src="/figma/home/news-hero.svg"
                  alt="뉴스 읽기"
                  width={66}
                  height={80}
                  priority
                />
              </div>
            </div>

            <Link
              href={dailyDone ? "/mypage/history" : todayHref}
              className="mt-[18px] flex h-14 w-full touch-manipulation items-center justify-center rounded-full bg-[#2f6bff] px-7 text-base leading-6 font-bold tracking-[0.0057em] text-white transition duration-150 active:scale-[0.985] active:bg-[#1f55e0]"
            >
              {dailyDone ? "오늘의 연습 기록 보기" : "오늘의 연습 시작하기"}
            </Link>
          </section>

          <h2 className="mt-[22px] text-xl leading-7 font-bold tracking-[-0.012em]">
            무엇을 연습할까요?
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {PRACTICE_CARDS.map((card) => (
              <PracticeTile key={card.title} {...card} />
            ))}
          </div>

          <h2 className="mt-12 mb-4 text-xl font-bold">이어서 하기</h2>
          <section className="design-card divide-y divide-[#f2f4f6] !py-0">
            {dashboard?.recentTraining && (
              <div className="flex items-center gap-3 py-5">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold">
                    {dashboard.recentTraining.title}
                  </h3>
                  <p className="mt-1 text-xs text-[#8b95a1]">
                    {dashboard.recentTraining.status === "COMPLETED"
                      ? "완료한 연습"
                      : "지난 연습을 이어서 시작해요"}
                  </p>
                </div>
                <Link
                  className="shrink-0 rounded-xl bg-[#edf2ff] px-4 py-3 text-xs font-bold text-primary"
                  href={
                    dashboard.recentTraining.status === "COMPLETED"
                      ? `/mypage/history/${dashboard.recentTraining.sessionId}`
                      : `/practice/${dashboard.recentTraining.contentId}?sessionId=${dashboard.recentTraining.sessionId}&resumeType=${dashboard.recentTraining.status === "ANALYZING" ? "ANALYSIS_STATUS" : "RECORDING"}&returnTo=%2Fhome`
                  }
                >
                  {dashboard.recentTraining.status === "COMPLETED"
                    ? "기록 보기"
                    : "이어하기"}
                </Link>
              </div>
            )}
            {recentCourses.map((course) => (
              <div
                key={String(course.id)}
                className="flex items-center gap-3 py-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold">
                    {course.courseType === "INTONATION"
                      ? "억양 클래스"
                      : "발음 클래스"}
                    <span className="ml-2 font-medium text-primary">
                      {Math.round(course.progressPercent)}%
                    </span>
                  </h3>
                  <p className="mt-1 truncate text-xs text-[#8b95a1]">
                    {course.title}
                  </p>
                </div>
                <Link
                  href={`/class/${course.courseType.toLowerCase()}`}
                  className="shrink-0 rounded-xl bg-[#edf2ff] px-4 py-3 text-xs font-bold text-primary"
                >
                  이어하기
                </Link>
              </div>
            ))}
            {!dashboard?.recentTraining && !recentCourses.length && (
              <p className="py-6 text-sm text-[#8b95a1]">
                연습을 시작하면 이어서 할 수 있어요.
              </p>
            )}
          </section>
        </div>
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
  badgeClassName,
}: PracticeCard) {
  return (
    <Link
      href={href}
      className="flex h-[138px] min-w-0 touch-manipulation flex-col overflow-hidden rounded-[18px] bg-white px-4 pt-4 pb-3 shadow-[0_2px_8px_rgba(26,33,48,0.06)] transition duration-150 active:scale-[0.98] active:shadow-[0_1px_4px_rgba(26,33,48,0.05)]"
    >
      <h3 className="text-sm leading-5 font-bold tracking-[0.0145em]">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-4 font-normal tracking-[0.0252em] text-[#4e5968]">
        {description}
      </p>
      <span className="flex-1" />
      <span
        className={`ml-auto flex size-11 shrink-0 items-center justify-center rounded-[17px] ${badgeClassName}`}
      >
        <Image src={icon} alt="" width={iconWidth} height={iconHeight} />
      </span>
    </Link>
  );
}
