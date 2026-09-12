"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { usePrototypeHistory } from "@/hooks/use-prototype-history";
import { todaySummary } from "@/lib/prototype-history";
import {
  api,
  type HomeDashboard,
  type PracticeContentSummary,
  type Recommendation,
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
    href: "/practice/custom",
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

const HOME_TABS = [
  { href: "/home", label: "홈", icon: "/figma/home/tab-home.svg" },
  {
    href: "/class",
    label: "클래스",
    icon: "/figma/home/tab-class.svg",
  },
  { href: "/mypage", label: "마이", icon: "/figma/home/tab-my.svg" },
] as const;

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
  const history = usePrototypeHistory();
  const completed = todaySummary(history.items);
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [developmentPreview, setDevelopmentPreview] = useState(false);

  useEffect(() => {
    const preview = process.env.NODE_ENV === "development";
    setDevelopmentPreview(preview);
    if (preview) {
      setDashboard(EMPTY_DASHBOARD);
      return;
    }

    let active = true;
    void (async () => {
      const [dashboardResult, recommendationResult] = await Promise.allSettled([
        api.home.get(),
        api.home.getRecommendations({ limit: 3 }),
      ]);
      if (!active) return;

      const nextDashboard =
        dashboardResult.status === "fulfilled"
          ? dashboardResult.value
          : EMPTY_DASHBOARD;
      setDashboard(nextDashboard);

      if (recommendationResult.status === "fulfilled") {
        setRecommendations(recommendationResult.value.slice(0, 3));
      } else if (nextDashboard.recommendations.length === 0) {
        try {
          const fallback = await api.content.list({ page: 0, size: 3 });
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
  const todayHref =
    process.env.NODE_ENV === "development"
      ? "/news/today"
      : firstRecommendation
        ? `/practice/${firstRecommendation.contentId}?returnTo=%2Fhome`
        : "/news/today";

  return (
    <IPhoneFrame>
      <div className="flex h-full flex-col bg-[#f5f6f8] text-[#191f28]">
        <div className="h-11 shrink-0" aria-hidden="true" />

        <header className="flex h-12 shrink-0 items-center px-5 pt-1.5 pb-3.5">
          <Image
            src="/figma/home/logo.svg"
            alt="SpeakAI"
            width={36}
            height={30.31584}
            className="h-auto w-[36px]"
            priority
          />
          <span className="flex-1" />
          <button
            type="button"
            aria-label="알림"
            className="mr-2 flex size-8 items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
          >
            <Image src="/figma/home/bell.svg" alt="" width={28} height={28} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[26px]">
          {error ? <p className="sr-only">{error}</p> : null}

          <section className="h-[360px] overflow-hidden rounded-[20px] bg-white px-5 pt-6 pb-5 shadow-[0_2px_8px_rgba(26,33,48,0.06)]">
            <p className="inline-flex h-[26px] items-center rounded-full bg-[#edf2ff] px-3 text-[11px] leading-[14px] font-bold tracking-[0.034em] text-[#2f6bff]">
              발표 코스 1일차
            </p>

            <h1 className="mt-3.5 text-[22px] leading-[30px] font-bold tracking-[-0.0194em]">
              {completed.dailyDone
                ? "오늘의 연습을 마쳤어요"
                : "오늘은 뉴스 읽기예요"}
              <br />
              {completed.dailyDone
                ? "조금씩 꾸준히, 잘하고 있어요"
                : "3문장이면 끝나요"}
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
              href={completed.dailyDone ? "/home/history" : todayHref}
              className="mt-[18px] flex h-14 w-full touch-manipulation items-center justify-center rounded-full bg-[#2f6bff] px-7 text-base leading-6 font-bold tracking-[0.0057em] text-white transition duration-150 active:scale-[0.985] active:bg-[#1f55e0]"
            >
              {completed.dailyDone
                ? "오늘의 연습 기록 보기"
                : "오늘의 연습 시작하기"}
            </Link>
          </section>

          {process.env.NODE_ENV === "development" && (
            <Link
              href="/home/history"
              className="mt-4 block rounded-2xl bg-white p-4 shadow-sm"
            >
              <p className="text-sm font-bold">
                {history.error
                  ? "연습 기록을 불러오지 못했어요"
                  : `오늘 ${completed.sentences}문장 · ${completed.count}회 연습 완료`}
              </p>
              <p className="mt-1 text-xs text-[#8b95a1]">
                {history.items[0]
                  ? `최근 연습: ${history.items[0].title}`
                  : "연습을 마치면 기록이 쌓여요"}{" "}
                · 기록 보기
              </p>
            </Link>
          )}
          <h2 className="mt-[22px] text-xl leading-7 font-bold tracking-[-0.012em]">
            무엇을 연습할까요?
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {PRACTICE_CARDS.map((card) => {
              const href =
                developmentPreview &&
                ["/announcer", "/sentences"].includes(card.href)
                  ? `${card.href}?preview=1`
                  : card.href;

              return <PracticeTile key={card.href} {...card} href={href} />;
            })}
          </div>
        </div>

        <nav className="h-[63px] shrink-0 border-t border-[#e6eaee] bg-white">
          <ul className="flex h-full items-start py-2">
            {HOME_TABS.map((tab) => {
              const active = tab.href === "/home";
              return (
                <li key={tab.href} className="min-w-0 flex-1">
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className="flex flex-col items-center gap-1 active:opacity-70"
                  >
                    <Image src={tab.icon} alt="" width={28} height={28} />
                    <span
                      className={`text-xs leading-4 tracking-[0.0252em] ${
                        active
                          ? "font-bold text-[#2f6bff]"
                          : "font-medium text-[#8b95a1]"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div
          className="h-[max(34px,env(safe-area-inset-bottom))] shrink-0 bg-white"
          aria-hidden="true"
        />
      </div>
    </IPhoneFrame>
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
