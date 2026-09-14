"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings, ChevronRight, UserRound, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  api,
  type Statistics,
  type StrengthsWeaknesses,
  type TrainingHistoryItem,
  type UserAccount,
} from "@/lib/api";
import { useProfile } from "@/lib/use-profile";
import { METHOD_OPTIONS } from "@/lib/onboarding-options";
import { getCachedUser } from "@/lib/auth-session";

export default function MyPage() {
  const { profile } = useProfile();
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [feedback, setFeedback] = useState<StrengthsWeaknesses | null>(null);
  const [history, setHistory] = useState<TrainingHistoryItem[]>([]);
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
    ])
      .then(([user, stats, strengthsWeaknesses, sessions]) => {
        if (!active) return;
        setAccount(user);
        setStatistics(stats);
        setFeedback(strengthsWeaknesses);
        setHistory(sessions.items);
      })
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
  const hours = Math.floor((statistics?.totalLearningSeconds ?? 0) / 3600);
  const minutes = Math.floor(
    ((statistics?.totalLearningSeconds ?? 0) % 3600) / 60,
  );
  const methods = profile?.learningSituations
    .map(
      (value) =>
        METHOD_OPTIONS.find((item) => item.value === value)?.summary ?? value,
    )
    .join(", ");
  return (
    <AppShell>
      <header className="flex h-[92px] items-end justify-between px-5 pb-5">
        <h1 className="text-lg font-bold">마이</h1>
        <Link href="/mypage/settings" aria-label="설정" className="-m-2 p-2">
          <Settings className="size-5" />
        </Link>
      </header>
      <Link
        href="/mypage/settings/profile"
        className="flex items-center gap-3 bg-white px-5 py-1"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-[#edf2ff] text-primary">
          <UserRound className="size-7 fill-current" />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">
              {displayName ?? "불러오는 중…"}
            </h2>
            {profile && (
              <span className="rounded-full bg-[#e8efff] px-3 py-1 text-xs font-semibold text-primary">
                {
                  { beginner: "초급", intermediate: "중급", advanced: "고급" }[
                    profile.level
                  ]
                }
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#8b95a1]">
            {profile
              ? `하루 ${profile.minutesPerDay}분 연습`
              : "나만의 말하기 연습"}
          </p>
        </div>
        <ChevronRight className="size-5 text-[#8b95a1]" />
      </Link>
      <div className="space-y-4 px-5 pt-3 pb-8">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/5 p-3 text-xs text-destructive"
          >
            {error}
          </p>
        )}
        <section className="design-card">
          <p className="flex items-baseline gap-2">
            <strong className="text-[26px] font-bold text-primary">
              {statistics?.consecutiveLearningDays ?? 0}일째
            </strong>
            <span className="text-sm font-bold">연속 연습 중이에요</span>
          </p>
          <div className="mt-4 grid grid-cols-3 divide-x divide-[#f2f4f6] border-t border-[#f2f4f6] pt-5 text-center">
            <Metric
              label="연습 횟수"
              value={`${statistics?.totalSessionCount ?? 0}회`}
            />
            <Metric label="연습 시간" value={`${hours}시간 ${minutes}분`} />
            <Metric
              label="평균 점수"
              value={
                statistics?.totalSessionCount
                  ? `${Math.round(statistics.averageOverallScore)}점`
                  : "—"
              }
            />
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center text-sm font-bold">
              <Sparkles className="mr-1 size-5 fill-primary text-primary" />내
              발음 리포트
            </h2>
            <span className="text-[11px] text-[#8b95a1]">
              이번 달 연습 기준
            </span>
          </div>
          <div className="rounded-[20px] bg-[#edf2ff] p-[18px]">
            <ReportRow
              title="잘하는 발음"
              tone="green"
              items={(feedback?.strengths ?? []).map((item) => item.label)}
            />
            <ReportRow
              title="자주 틀리는 발음"
              tone="red"
              items={(feedback?.weaknesses ?? []).map((item) => item.label)}
            />
            <ReportRow
              title="억양 특성"
              tone="blue"
              items={["문장 끝을 올려 읽는 편"]}
              sample
            />
            <Link
              href="/class/pronunciation"
              className="design-action mt-4 !min-h-12"
            >
              약점 집중 연습하기
            </Link>
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">연습 기록</h2>
            <Link href="/mypage/history" className="text-xs text-primary">
              전체 보기
            </Link>
          </div>
          <div className="design-card divide-y divide-[#f2f4f6] !px-[18px] !py-0">
            {history.length ? (
              history.slice(0, 3).map((item) => (
                <Link
                  key={String(item.sessionId)}
                  href={`/mypage/history/${item.sessionId}`}
                  className="flex items-center gap-3 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold">{item.title}</h3>
                    <p className="mt-1 text-xs text-[#8b95a1]">연습 완료</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-primary">
                      {Math.round(item.overallScore)}점
                    </p>
                    <p className="mt-1 text-[10px] text-[#8b95a1]">
                      {new Date(item.completedAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-[#8b95a1]">
                아직 연습 기록이 없어요
              </p>
            )}
          </div>
        </section>
        <section className="design-card !p-[18px]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold">내 연습 계획</h2>
            <Link href="/mypage/plan" className="text-xs text-primary">
              수정
            </Link>
          </div>
          <dl className="space-y-4 text-xs">
            <PlanRow
              label="목표"
              value={profile?.goalDescription || "연습 목표를 설정해 보세요"}
            />
            <PlanRow
              label="연습 일정"
              value={
                profile ? `주 ${profile.weeklySessions}일` : "불러오는 중…"
              }
            />
            <PlanRow
              label="연습 방식"
              value={methods || "연습 방식을 선택해 주세요"}
            />
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="whitespace-nowrap text-base font-bold">{value}</p>
      <p className="mt-1 text-xs text-[#8b95a1]">{label}</p>
    </div>
  );
}
function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-5">
      <dt className="shrink-0 text-[#6b7684]">{label}</dt>
      <dd className="text-right font-semibold leading-5">{value}</dd>
    </div>
  );
}
function ReportRow({
  title,
  tone,
  items,
  sample = false,
}: {
  title: string;
  tone: "green" | "red" | "blue";
  items: string[];
  sample?: boolean;
}) {
  const colors = {
    green: "bg-[#e3f7ef] text-[#079777]",
    red: "bg-[#ffebe5] text-[#f05a38]",
    blue: "bg-white text-[#3468ff]",
  };
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs text-[#6b7684]">
        {title}
        {sample && (
          <span className="ml-1 text-[10px] text-[#8b95a1]">· 예시</span>
        )}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((item) => (
            <span
              key={item}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${colors[tone]}`}
            >
              {item}
            </span>
          ))
        ) : (
          <p className="text-xs text-[#8b95a1]">아직 분석할 기록이 없어요</p>
        )}
      </div>
    </div>
  );
}
