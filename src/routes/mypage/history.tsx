"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  api,
  type ContentType,
  type Statistics,
  type TrainingHistoryItem,
  type UserAccount,
  type UserTitleProgress,
} from "@/lib/api";
import { getCachedUser } from "@/lib/auth-session";
import { getUserTitleProgress } from "@/lib/user-title";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ value?: ContentType; label: string }> = [
  { label: "전체" },
  { value: "NEWS", label: "뉴스" },
  { value: "SENTENCE", label: "문장" },
  { value: "ANNOUNCER", label: "아나운서" },
  { value: "CLASS_PRACTICE", label: "클래스" },
];

const TYPE_LABEL: Record<ContentType, string> = {
  NEWS: "뉴스",
  SENTENCE: "문장",
  ANNOUNCER: "아나운서",
  CLASS_PRACTICE: "클래스",
};

function localStartOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function relativeDateLabel(value: string, now = new Date()) {
  const date = new Date(value);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days > 1 && days < 7) return `${days}일 전`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function LearningHistory() {
  const router = useRouter();
  const [kind, setKind] = useState<ContentType | undefined>();
  const [items, setItems] = useState<TrainingHistoryItem[]>([]);
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [titleProgress, setTitleProgress] = useState<UserTitleProgress | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [examStarting, setExamStarting] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = getCachedUser();
    Promise.all([
      cached ? Promise.resolve(cached) : api.users.getMe(),
      api.myPage.getStatistics({ period: "MONTH" }),
      api.users.getTitle().catch(() => null),
    ])
      .then(([user, stats, userTitle]) => {
        if (!active) return;
        setAccount(user);
        setStatistics(stats);
        setTitleProgress(
          userTitle ??
            getUserTitleProgress("ABSOLUTE_BEGINNER", stats.totalSessionCount),
        );
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "프로필을 불러오지 못했습니다.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setLoadMoreError(null);
    api.myPage
      .listTrainingSessions({
        type: kind,
        status: "COMPLETED",
        page: 0,
        size: 20,
      })
      .then((value) => {
        if (!active) return;
        setItems(value.items);
        setPage(value.page);
        setHasNext(Boolean(value.hasNext));
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "기록을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [kind]);

  const groups = useMemo(() => {
    const week = localStartOfWeek(new Date());
    const previous = new Date(week);
    previous.setDate(previous.getDate() - 7);
    return [
      {
        label: "이번 주",
        items: items.filter((item) => new Date(item.completedAt) >= week),
      },
      {
        label: "지난주",
        items: items.filter((item) => {
          const date = new Date(item.completedAt);
          return date >= previous && date < week;
        }),
      },
      {
        label: "이전 기록",
        items: items.filter((item) => new Date(item.completedAt) < previous),
      },
    ].filter((group) => group.items.length > 0);
  }, [items]);

  async function loadMore() {
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const value = await api.myPage.listTrainingSessions({
        type: kind,
        status: "COMPLETED",
        page: page + 1,
        size: 20,
      });
      setItems((current) => [...current, ...value.items]);
      setPage(value.page);
      setHasNext(Boolean(value.hasNext));
    } catch (reason) {
      setLoadMoreError(
        reason instanceof Error
          ? reason.message
          : "기록을 더 불러오지 못했습니다.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function startTitleExam() {
    setExamStarting(true);
    setError(null);
    try {
      const exam = await api.users.createTitleExam();
      router.push(
        `/practice/${encodeURIComponent(String(exam.practiceContentId))}?titleExamId=${encodeURIComponent(String(exam.id))}&returnTo=%2Fmypage%2Fhistory&start=1`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "승급 시험을 시작하지 못했습니다.",
      );
      setExamStarting(false);
    }
  }

  return (
    <AppShell
      chromeColor="#c5d6ff"
      viewportLocked
      className="relative overflow-hidden bg-[#f2f4f6]"
    >
      <ProfileBand
        account={account}
        statistics={statistics}
        titleProgress={titleProgress}
      />
      <div className="absolute inset-x-0 top-[262px] bottom-0 overflow-y-auto overscroll-y-contain bg-[#f2f4f6]">
        <MyPageHead
          active="history"
          titleProgress={titleProgress}
          examStarting={examStarting}
          onExam={() => void startTitleExam()}
        />

        <div className="overflow-hidden px-5 pt-3.5 pb-6">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((filter) => (
              <button
                key={filter.label}
                type="button"
                onClick={() => setKind(filter.value)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-[7px] text-[13px] leading-[18px] font-medium",
                  kind === filter.value
                    ? "bg-primary text-white"
                    : "bg-white text-[#4e5968]",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-12 text-center text-[13px] text-[#8b95a1]">
              기록을 불러오는 중…
            </p>
          ) : error ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl bg-white p-4 text-[13px] text-destructive"
            >
              {error}
            </p>
          ) : groups.length ? (
            <div className="mt-3 space-y-3">
              {groups.map((group) => (
                <section key={group.label}>
                  <h2 className="px-1 pt-2 pb-2 text-[12px] leading-4 font-bold text-[#8b95a1]">
                    {group.label}
                  </h2>
                  <div className="space-y-2.5">
                    {group.items.map((item) => (
                      <Link
                        key={String(item.sessionId)}
                        href={`/mypage/history/${item.sessionId}`}
                        className="flex min-h-[68px] items-center gap-3 rounded-2xl bg-white py-3.5 pr-3.5 pl-4"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="shrink-0 rounded-full bg-[#f2f4f6] px-[7px] py-0.5 text-[11px] leading-[14px] font-bold text-[#4e5968]">
                              {TYPE_LABEL[item.contentType]}
                            </span>
                            <strong className="truncate text-[15px] leading-[22px] font-bold text-[#191f28]">
                              {item.title}
                            </strong>
                          </span>
                          <span className="mt-[3px] block text-[12px] leading-4 text-[#b0b8c1]">
                            {relativeDateLabel(item.completedAt)}
                          </span>
                        </span>
                        <Image
                          src="/figma/catalog/chevron-right.svg"
                          alt=""
                          width={18}
                          height={18}
                        />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
              {hasNext ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  className="h-12 w-full rounded-full bg-white text-[14px] font-bold text-primary disabled:opacity-50"
                >
                  {loadingMore ? "불러오는 중…" : "기록 더 보기"}
                </button>
              ) : null}
              {loadMoreError ? (
                <p
                  role="alert"
                  className="text-center text-xs text-destructive"
                >
                  {loadMoreError}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="py-12 text-center text-[13px] text-[#8b95a1]">
              아직 저장된 학습 기록이 없어요.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ProfileBand({
  account,
  statistics,
  titleProgress,
}: {
  account: UserAccount | null;
  statistics: Statistics | null;
  titleProgress: UserTitleProgress | null;
}) {
  const next = titleProgress?.next;
  const span = next
    ? Math.max(
        1,
        next.requiredTrainingCount - titleProgress.minimumTrainingCount,
      )
    : 1;
  const percent = titleProgress
    ? next
      ? Math.min(
          100,
          Math.max(
            0,
            ((titleProgress.completedTrainingCount -
              titleProgress.minimumTrainingCount) /
              span) *
              100,
          ),
        )
      : 100
    : 0;
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-[262px] bg-[#c5d6ff]" />
      <header className="absolute inset-x-0 top-0 z-10 grid h-10 grid-cols-[24px_1fr_24px] items-center px-5">
        <span />
        <h1 className="text-center text-[17px] leading-6 font-bold">마이</h1>
        <Link
          href="/mypage/settings"
          aria-label="설정"
          className="flex size-10 -translate-x-2 items-center justify-center justify-self-center"
        >
          <Image
            src="/figma/mypage/settings.svg"
            alt=""
            width={24}
            height={24}
          />
        </Link>
      </header>
      <section className="absolute inset-x-0 top-10 z-10 flex h-[222px] flex-col items-center pt-5">
        <Link
          href="/mypage/settings/profile"
          className="relative size-[104px] rounded-[42px] p-1.5"
          aria-label="프로필 수정"
          style={{
            background: `conic-gradient(#2f6bff ${percent * 3.6}deg, rgba(255,255,255,.58) 0deg)`,
          }}
        >
          <span className="relative block size-full overflow-hidden rounded-[37px] border-2 border-white bg-[#edf2ff]">
            <Image
              src="/figma/mypage/avatar-character.png"
              alt=""
              fill
              sizes="92px"
              className="scale-[1.18] object-contain object-bottom"
              priority
            />
          </span>
          {titleProgress ? (
            <span className="absolute top-[89px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white bg-primary px-2.5 py-1 text-[11px] leading-[14px] font-bold text-white">
              {titleProgress.label}
            </span>
          ) : null}
        </Link>
        <h2 className="mt-5 text-[20px] leading-7 font-bold">
          {account?.nickname ?? "불러오는 중…"}
        </h2>
        {statistics ? (
          <p className="mt-1 flex items-center gap-2 text-[13px] leading-[18px] font-medium text-[#3d4a5c]">
            <span>연속 {statistics.consecutiveLearningDays}일</span>
            <span className="h-2.5 w-px bg-[#8fa0bc]" />
            <span>총 {statistics.totalSessionCount}회 연습</span>
          </p>
        ) : null}
      </section>
    </>
  );
}

function MyPageHead({
  active,
  titleProgress,
  examStarting,
  onExam,
}: {
  active: "summary" | "history" | "plan";
  titleProgress: UserTitleProgress | null;
  examStarting: boolean;
  onExam: () => void;
}) {
  return (
    <div className="bg-white px-5 pt-4">
      {titleProgress ? (
        <div className="flex min-h-[72px] items-center gap-3 rounded-[20px] bg-[#edf2ff] py-4 pr-4 pl-[18px]">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-[22px] font-bold">
              {titleProgress.next?.eligible
                ? "승급 시험 응시 가능"
                : titleProgress.next
                  ? `연습 ${titleProgress.next.remainingTrainingCount}회 남았어요`
                  : "최고 칭호 달성"}
            </p>
            <p className="mt-[3px] truncate text-[12px] leading-4 font-medium text-[#4e5968]">
              {titleProgress.next
                ? `다음 칭호  ${titleProgress.next.label}  `
                : "누적 연습  "}
              <b className="text-primary">
                {titleProgress.completedTrainingCount}
              </b>
              <span className="text-[#8b95a1]">
                /
                {titleProgress.next?.requiredTrainingCount ??
                  titleProgress.completedTrainingCount}
                회
              </span>
            </p>
          </div>
          {titleProgress.next?.eligible ? (
            <button
              type="button"
              onClick={onExam}
              disabled={examStarting}
              className="flex shrink-0 items-center gap-0.5 rounded-xl bg-primary px-3.5 py-2.5 text-[14px] leading-5 font-bold text-white disabled:opacity-60"
            >
              {examStarting ? "준비 중" : "시험 보기"}
              <Image
                src="/figma/mypage/chevron-right-white.svg"
                alt=""
                width={16}
                height={16}
              />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="h-[72px] animate-pulse rounded-[20px] bg-[#edf2ff]" />
      )}
      <nav className="mt-2.5 grid h-11 grid-cols-3 border-b border-[#e5e8eb]">
        {[
          ["summary", "/mypage", "요약"],
          ["history", "/mypage/history", "기록"],
          ["plan", "/mypage/plan", "계획"],
        ].map(([key, href, label]) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "relative flex items-center justify-center text-[15px] leading-[22px]",
              active === key
                ? "font-bold text-[#191f28] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#191f28]"
                : "font-medium text-[#8b95a1]",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
