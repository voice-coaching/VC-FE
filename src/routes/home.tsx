"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, Mic, PenLine, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GOAL_LABELS } from "@/lib/app-data";
import {
  api,
  type HomeDashboard,
  type PracticeContentSummary,
  type Recommendation,
} from "@/lib/api";
import { useProfile } from "@/lib/use-profile";

type RecommendationCard = Pick<
  Recommendation,
  "contentId" | "title" | "reason"
>;

const EMPTY_DASHBOARD: HomeDashboard = {
  today: { completedCount: 0, goalCount: 0, learningSeconds: 0 },
  recommendations: [],
  recentTraining: null,
  courseProgress: null,
};

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
  return [...primary, ...fallback]
    .filter((item) => {
      const id = String(item.contentId);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 3);
}

export default function Home() {
  const { profile } = useProfile();
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [recommendations, setRecommendations] = useState<
    RecommendationCard[]
  >([]);
  const [recommendationsLoaded, setRecommendationsLoaded] = useState(false);
  const [activeRecommendation, setActiveRecommendation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const goal = profile?.goals[0];

  useEffect(() => {
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
          if (active) setRecommendations(generalRecommendations(fallback.items));
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

      if (active) setRecommendationsLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const recommendationItems = combineRecommendations(
    recommendations,
    dashboard?.recommendations ?? [],
  );
  const recommendationIndex =
    recommendationItems.length === 0
      ? 0
      : activeRecommendation % recommendationItems.length;
  const visibleRecommendation = recommendationItems[recommendationIndex];

  useEffect(() => {
    if (recommendationItems.length < 2) return;
    const interval = window.setInterval(
      () => setActiveRecommendation((index) => index + 1),
      4500,
    );
    return () => window.clearInterval(interval);
  }, [recommendationItems.length]);

  const recent = dashboard?.recentTraining;
  const recentHref = recent
    ? recent.status === "COMPLETED"
      ? `/mypage/history/${recent.sessionId}`
      : `/practice/${recent.contentId}?sessionId=${recent.sessionId}&resumeType=${recent.status === "ANALYZING" ? "ANALYSIS_STATUS" : "RECORDING"}&returnTo=%2Fhome`
    : "/home";

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-10">
        <h1 className="text-4xl font-black tracking-tighter">또박</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile && goal ? (
            <>
              {profile.name}님, 오늘의 목표는{" "}
              <span className="font-semibold text-foreground">
                {GOAL_LABELS[goal]}
              </span>
              예요.
            </>
          ) : (
            "프로필을 불러오는 중…"
          )}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <Stat
            icon={<Flame className="size-3.5" />}
            label="오늘 완료"
            value={
              dashboard ? `${dashboard.today.completedCount}회` : undefined
            }
          />
          <Stat
            icon={<TrendingUp className="size-3.5" />}
            label="오늘 목표"
            value={dashboard ? `${dashboard.today.goalCount}회` : undefined}
          />
          <Stat
            icon={<Mic className="size-3.5" />}
            label="학습 시간"
            value={
              dashboard
                ? `${Math.round(dashboard.today.learningSeconds / 60)}분`
                : undefined
            }
          />
        </div>

        <p className="mt-8 mb-3 text-xs font-semibold text-muted-foreground">
          개인화 추천
        </p>
        {visibleRecommendation ? (
          <div className="overflow-hidden">
            <Link
              key={String(visibleRecommendation.contentId)}
              href={`/practice/${visibleRecommendation.contentId}?returnTo=%2Fhome`}
              className="block animate-in rounded-2xl border border-border px-5 py-4 text-[15px] font-semibold fade-in-0 slide-in-from-bottom-2 duration-500 hover:bg-surface"
            >
              <span className="mr-2 rounded-full bg-brand px-2 py-0.5 text-[10px] text-brand-foreground align-middle">
                {recommendationIndex + 1}순위
              </span>
              {visibleRecommendation.title}
              <p className="mt-2 text-xs font-normal text-muted-foreground">
                {visibleRecommendation.reason}
              </p>
            </Link>
            {recommendationItems.length > 1 && (
              <div
                className="mt-2 flex justify-center gap-1.5"
                aria-label="개인화 추천 순위"
              >
                {recommendationItems.map((item, index) => (
                  <button
                    key={String(item.contentId)}
                    type="button"
                    aria-label={`${index + 1}순위 추천 보기`}
                    aria-pressed={recommendationIndex === index}
                    onClick={() => setActiveRecommendation(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      recommendationIndex === index
                        ? "w-5 bg-foreground"
                        : "w-1.5 bg-border"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-2xl border border-border px-5 py-4 text-sm text-muted-foreground">
            {recommendationsLoaded
              ? "추천할 학습 콘텐츠가 아직 없습니다."
              : "추천 학습을 불러오는 중…"}
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Tile to="/news" title="오늘의 뉴스" sub="난이도별 스크립트" />
          <Tile to="/sentences" title="문장 연습" sub="받침·자음·모음" />
          <Tile
            to="/announcer"
            title={"아나운서\n따라 읽기"}
            sub="예시 듣고 비교"
          />
          <Tile
            to="/class/pronunciation"
            title="발음 클래스"
            sub="원리부터 단계별로"
          />
          <Tile to="/class/intonation" title="억양 클래스" sub="리듬·높낮이" />
        </div>

        {recent && (
          <Link
            href={recentHref}
            className="mt-3 flex items-center justify-between rounded-2xl border border-border px-5 py-4 text-sm font-semibold"
          >
            최근 학습 이어하기 ·
            {recent.title}
            <span className="text-xs text-muted-foreground">
              {recent.status}
            </span>
          </Link>
        )}
        <Link
          href="/class"
          className="mt-3 flex items-center justify-between rounded-2xl bg-surface px-5 py-4 text-sm font-semibold"
        >
          클래스 전체 보기
          <PenLine className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex-1 rounded-2xl border border-border px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tracking-tight">{value ?? "—"}</p>
    </div>
  );
}

function Tile({ to, title, sub }: { to: string; title: string; sub: string }) {
  return (
    <Link
      href={to}
      className="flex aspect-square flex-col justify-between rounded-2xl bg-surface p-4 transition-colors hover:bg-muted"
    >
      <span className="text-[10px] text-muted-foreground">{sub}</span>
      <span className="text-[15px] leading-snug font-semibold whitespace-pre-line">
        {title}
      </span>
    </Link>
  );
}
