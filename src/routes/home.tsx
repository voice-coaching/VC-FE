"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, Mic, PenLine, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GOAL_LABELS } from "@/lib/app-data";
import { api, type HomeDashboard } from "@/lib/api";
import { useProfile } from "@/lib/use-profile";

export default function Home() {
  const { profile } = useProfile();
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const goal = profile?.goals[0];

  useEffect(() => {
    let active = true;
    api.home
      .get()
      .then((value) => active && setDashboard(value))
      .catch(
        (reason) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "홈 정보를 불러오지 못했습니다.",
          ),
      );
    return () => {
      active = false;
    };
  }, []);

  const firstRecommendation = dashboard?.recommendations[0];

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-10">
        <h1 className="text-4xl font-black tracking-tighter">또박</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile ? `${profile.name}님` : "회원님"}, 오늘의 목표는{" "}
          <span className="font-semibold text-foreground">
            {goal ? GOAL_LABELS[goal] : "또렷하게 말하기"}
          </span>
          예요.
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
            value={`${dashboard?.today.completedCount ?? 0}회`}
          />
          <Stat
            icon={<TrendingUp className="size-3.5" />}
            label="오늘 목표"
            value={`${dashboard?.today.goalCount ?? 0}회`}
          />
          <Stat
            icon={<Mic className="size-3.5" />}
            label="학습 시간"
            value={`${Math.round((dashboard?.today.learningSeconds ?? 0) / 60)}분`}
          />
        </div>

        <p className="mt-8 mb-3 text-xs font-semibold text-muted-foreground">
          개인화 추천
        </p>
        {firstRecommendation ? (
          <Link
            href={`/practice/${firstRecommendation.contentId}`}
            className="block rounded-2xl border border-border px-5 py-4 text-[15px] font-semibold transition-colors hover:bg-surface"
          >
            <span className="mr-2 rounded-full bg-brand px-2 py-0.5 text-[10px] text-brand-foreground align-middle">
              1순위
            </span>
            {firstRecommendation.title}
            <p className="mt-2 text-xs font-normal text-muted-foreground">
              {firstRecommendation.reason}
            </p>
          </Link>
        ) : (
          <p className="rounded-2xl border border-border px-5 py-4 text-sm text-muted-foreground">
            추천 학습을 불러오는 중…
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
          <Tile
            to="/practice/custom"
            title={"내 문장을 넣어서\n연습하기"}
            sub="BM · Pro"
            badge
          />
        </div>

        {dashboard?.recentTraining && (
          <Link
            href={`/practice/${dashboard.recentTraining.contentId}`}
            className="mt-3 flex items-center justify-between rounded-2xl border border-border px-5 py-4 text-sm font-semibold"
          >
            최근 학습 이어하기 · {dashboard.recentTraining.title}
            <span className="text-xs text-muted-foreground">
              {dashboard.recentTraining.status}
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
  value: string;
}) {
  return (
    <div className="flex-1 rounded-2xl border border-border px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}

function Tile({
  to,
  title,
  sub,
  badge,
}: {
  to: string;
  title: string;
  sub: string;
  badge?: boolean;
}) {
  return (
    <Link
      href={to}
      className="flex aspect-square flex-col justify-between rounded-2xl bg-surface p-4 transition-colors hover:bg-muted"
    >
      <span className="text-[10px] text-muted-foreground">{sub}</span>
      <span className="text-[15px] leading-snug font-semibold whitespace-pre-line">
        {title}
        {badge && (
          <span className="ml-1.5 rounded-full bg-warning px-1.5 py-0.5 align-middle text-[9px] text-warning-foreground">
            BM
          </span>
        )}
      </span>
    </Link>
  );
}
