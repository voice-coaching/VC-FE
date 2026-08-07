"use client";

import Link from "next/link";
import { Flame, Mic, PenLine, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GOAL_LABELS, NEWS_TODAY } from "@/lib/app-data";
import { useProfile } from "@/lib/use-profile";

export default function Home() {
  const { profile } = useProfile();
  const goal = profile?.goals[0];

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-10">
        <h1 className="text-4xl font-black tracking-tighter">또박</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile ? `${profile.name}님` : "또박이님"}, 오늘의 목표는{" "}
          <span className="font-semibold text-foreground">
            {goal ? GOAL_LABELS[goal] : "또렷하게 말하기"}
          </span>
          예요.
        </p>

        <div className="mt-5 flex gap-2">
          <Stat icon={<Flame className="size-3.5" />} label="연속 학습" value="7일" />
          <Stat icon={<TrendingUp className="size-3.5" />} label="평균 점수" value="82" />
          <Stat
            icon={<Mic className="size-3.5" />}
            label="오늘 목표"
            value={`${profile?.minutesPerDay ?? 10}분`}
          />
        </div>

        <p className="mt-8 mb-3 text-xs font-semibold text-muted-foreground">
          온보딩 기준 추천 순서
        </p>

        <Link
          href={`/practice/${NEWS_TODAY[0].id}`}
          className="block rounded-2xl border border-border px-5 py-4 text-[15px] font-semibold transition-colors hover:bg-surface"
        >
          <span className="mr-2 rounded-full bg-brand px-2 py-0.5 text-[10px] text-brand-foreground align-middle">
            1순위
          </span>
          오늘의 뉴스 스크립트 읽기
        </Link>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Tile to="/news" title="오늘의 뉴스" sub="난이도별 스크립트" />
          <Tile to="/sentences" title="문장 연습" sub="받침·자음·모음" />
          <Tile to="/announcer" title={"아나운서\n따라 읽기"} sub="예시 듣고 비교" />
          <Tile to="/class/pronunciation" title="발음 클래스" sub="원리부터 단계별로" />
          <Tile to="/class/intonation" title="억양 클래스" sub="리듬·높낮이" />
          <Tile to="/practice/custom" title={"내 문장을 넣어서\n연습하기"} sub="BM · Pro" badge />
        </div>

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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
