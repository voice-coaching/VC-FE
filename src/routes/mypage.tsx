"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Settings,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GOAL_LABELS, LEVEL_LABELS, scoreColor } from "@/lib/app-data";
import {
  api,
  type ScoreTrend,
  type Statistics,
  type StrengthsWeaknesses,
  type TrainingHistoryItem,
  type UserAccount,
  type WeaknessRecommendations,
} from "@/lib/api";
import { useProfile } from "@/lib/use-profile";
import { getCachedUser } from "@/lib/auth-session";

export default function MyPage() {
  const { profile } = useProfile();
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [feedback, setFeedback] = useState<StrengthsWeaknesses | null>(null);
  const [history, setHistory] = useState<TrainingHistoryItem[]>([]);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrend | null>(null);
  const [recommendations, setRecommendations] =
    useState<WeaknessRecommendations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const cachedUser = getCachedUser();
    Promise.all([
      cachedUser ? Promise.resolve(cachedUser) : api.users.getMe(),
      api.myPage.getStatistics({ period: "MONTH" }),
      api.myPage.getStrengthsWeaknesses({ period: "MONTH", limit: 5 }),
      api.myPage.listTrainingSessions({
        status: "COMPLETED",
        page: 0,
        size: 5,
      }),
      api.myPage.getScoreTrends("PRONUNCIATION", "MONTH"),
      api.myPage.getWeaknessRecommendations({ limit: 3 }),
    ])
      .then(
        ([
          user,
          stats,
          strengthsWeaknesses,
          sessions,
          trend,
          weaknessRecommendations,
        ]) => {
          if (!active) return;
          setAccount(user);
          setStatistics(stats);
          setFeedback(strengthsWeaknesses);
          setHistory(sessions.items);
          setScoreTrend(trend);
          setRecommendations(weaknessRecommendations);
        },
      )
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "마이페이지를 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const displayName = account?.nickname ?? profile?.name;

  return (
    <AppShell>
      <div className="px-5 pt-6 pb-10">
        <div className="flex justify-end">
          <Link
            href="/mypage/settings"
            aria-label="계정 설정"
            className="text-muted-foreground"
          >
            <Settings className="size-5" />
          </Link>
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-2">
          <div>
            <p className="text-xl font-bold tracking-tight">
              {displayName ?? "불러오는 중…"}
            </p>
            {statistics && (
              <div className="mt-1.5 flex gap-2">
                <Chip
                  icon={<CheckCircle2 className="size-3" />}
                  label="연속 학습"
                  value={`${statistics.consecutiveLearningDays}일`}
                />
                <Chip
                  icon={<Clock className="size-3" />}
                  label="학습 기록"
                  value={`${statistics.totalSessionCount}회`}
                />
              </div>
            )}
          </div>
        </div>

        <section className="mt-6 rounded-3xl border border-border p-5">
          <h2 className="text-sm font-semibold">AI Total Feedback</h2>
          <div className="mt-4 flex flex-col gap-3">
            <Block
              icon={<ThumbsUp className="size-3.5 text-success" />}
              title="강점"
              items={(feedback?.strengths ?? []).map(
                (item) => `${item.label} · ${Math.round(item.averageScore)}점`,
              )}
            />
            <Block
              icon={<ThumbsDown className="size-3.5 text-destructive" />}
              title="약점"
              items={(feedback?.weaknesses ?? []).map(
                (item) => `${item.label} · ${item.commonErrorType}`,
              )}
            />
          </div>
          {!feedback?.minimumDataSatisfied && (
            <p className="mt-3 text-xs text-muted-foreground">
              정확한 분석을 위해 학습 기록이 더 필요합니다.
            </p>
          )}
          <Link
            href="/class/pronunciation"
            className="mt-4 block w-full rounded-full bg-foreground py-3.5 text-center text-xs font-semibold text-background"
          >
            약점 집중 훈련 시작
          </Link>
        </section>

        {scoreTrend && scoreTrend.points.length > 0 && (
          <section className="mt-6 rounded-3xl bg-surface p-5">
            <h2 className="text-sm font-semibold">발음 점수 변화</h2>
            <div className="mt-4 flex h-28 items-end gap-2">
              {scoreTrend.points.map((point) => (
                <div
                  key={point.date}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2"
                >
                  <span className="text-[10px] font-semibold">
                    {Math.round(point.score)}
                  </span>
                  <span
                    className="w-full rounded-t-lg bg-brand"
                    style={{ height: `${Math.max(8, point.score)}%` }}
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(point.date).toLocaleDateString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {recommendations && recommendations.recommendations.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold">약점 맞춤 추천</h2>
            <div className="space-y-2">
              {recommendations.recommendations.map((item) => {
                const href = item.contentId
                  ? `/practice/${item.contentId}?returnTo=%2Fmypage`
                  : "/class";
                return (
                  <Link
                    key={`${item.targetType}-${item.contentId ?? item.courseId ?? item.title}`}
                    href={href}
                    className="block rounded-2xl border border-border px-4 py-3.5"
                  >
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.reason}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">내 훈련 기록</h2>
            <Link
              href="/mypage/history"
              className="text-xs font-semibold underline"
            >
              전체 보기·필터
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {history.map((item) => (
              <Link
                key={String(item.sessionId)}
                href={`/mypage/history/${item.sessionId}`}
                className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5"
              >
                <div>
                  <p className="text-[13px] font-semibold">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(item.completedAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <span
                  className={`text-lg font-bold ${scoreColor(item.overallScore)}`}
                >
                  {Math.round(item.overallScore)}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-surface p-5">
          <h2 className="text-sm font-semibold">
            내가 이 앱에서 이루고 싶은 것
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(profile?.goals ?? []).map((goal) => (
              <li
                key={goal}
                className="rounded-full bg-background px-3 py-1.5 text-xs font-medium"
              >
                {GOAL_LABELS[goal]}
              </li>
            ))}
          </ul>
          {profile && (
            <p className="mt-3 text-xs text-muted-foreground">
              현재 수준: {LEVEL_LABELS[profile.level]} · 하루{" "}
              {profile.minutesPerDay}분
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            온보딩 설문은 가입할 때 한 번만 진행합니다.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function Chip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px]">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <b className="font-semibold">{value}</b>
    </span>
  );
}

function Block({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        {icon}
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="text-xs leading-relaxed text-muted-foreground"
          >
            · {item}
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground">
            아직 분석 데이터가 없습니다.
          </li>
        )}
      </ul>
    </div>
  );
}
