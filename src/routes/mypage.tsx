"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  api,
  type Statistics,
  type StrengthsWeaknesses,
  type UserAccount,
  type UserTitleProgress,
} from "@/lib/api";
import { getCachedUser } from "@/lib/auth-session";
import {
  readMyPageOverviewCache,
  updateMyPageOverviewCache,
} from "@/lib/my-page-cache";
import { getUserTitleProgress } from "@/lib/user-title";

function titlePercent(progress: UserTitleProgress | null) {
  if (!progress) return 0;
  if (!progress.next) return 100;
  const span = Math.max(
    1,
    progress.next.requiredTrainingCount - progress.minimumTrainingCount,
  );
  const completed =
    progress.completedTrainingCount - progress.minimumTrainingCount;
  return Math.min(100, Math.max(0, Math.round((completed / span) * 100)));
}

export default function MyPage() {
  const router = useRouter();
  const [initialOverview] = useState(readMyPageOverviewCache);
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [statistics, setStatistics] = useState<Statistics | null>(
    initialOverview?.statistics ?? null,
  );
  const [feedback, setFeedback] = useState<StrengthsWeaknesses | null>(
    initialOverview?.feedback ?? null,
  );
  const [titleProgress, setTitleProgress] = useState<UserTitleProgress | null>(
    initialOverview?.titleProgress ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [examStarting, setExamStarting] = useState(false);

  useEffect(() => {
    let active = true;
    const cachedUser = getCachedUser();
    void Promise.allSettled([
      cachedUser ? Promise.resolve(cachedUser) : api.users.getMe(),
      api.myPage.getStatistics({ period: "MONTH" }),
      api.myPage.getStrengthsWeaknesses({ period: "MONTH", limit: 5 }),
      api.users.getTitle(),
    ]).then(([userResult, statsResult, feedbackResult, titleResult]) => {
      if (!active) return;
      const cachePatch: Parameters<typeof updateMyPageOverviewCache>[0] = {};

      if (userResult.status === "fulfilled") {
        setAccount(userResult.value);
        cachePatch.nickname = userResult.value.nickname;
      }
      if (statsResult.status === "fulfilled") {
        setStatistics(statsResult.value);
        cachePatch.statistics = statsResult.value;
      }
      if (feedbackResult.status === "fulfilled") {
        setFeedback(feedbackResult.value);
        cachePatch.feedback = feedbackResult.value;
      }

      if (titleResult.status === "fulfilled") {
        setTitleProgress(titleResult.value);
        cachePatch.titleProgress = titleResult.value;
      } else if (
        statsResult.status === "fulfilled" &&
        !initialOverview?.titleProgress
      ) {
        const fallback = getUserTitleProgress(
          "ABSOLUTE_BEGINNER",
          statsResult.value.totalSessionCount,
        );
        setTitleProgress(fallback);
        cachePatch.titleProgress = fallback;
      }

      if (Object.keys(cachePatch).length > 0) {
        updateMyPageOverviewCache(cachePatch);
      }

      const firstUncoveredFailure =
        userResult.status === "rejected" &&
        !cachedUser &&
        !initialOverview?.nickname
          ? userResult
          : statsResult.status === "rejected" && !initialOverview?.statistics
            ? statsResult
            : feedbackResult.status === "rejected" && !initialOverview?.feedback
              ? feedbackResult
              : null;
      if (firstUncoveredFailure) {
        setError(
          firstUncoveredFailure.reason instanceof Error
            ? firstUncoveredFailure.reason.message
            : "마이페이지를 불러오지 못했습니다.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [initialOverview]);

  const percent = titlePercent(titleProgress);
  const displayName = account?.nickname ?? initialOverview?.nickname;
  const totalSeconds = statistics?.totalLearningSeconds ?? 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const learningTime = hours ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  async function startTitleExam() {
    setExamStarting(true);
    setError(null);
    try {
      const exam = await api.users.createTitleExam();
      router.push(
        `/practice/${encodeURIComponent(String(exam.practiceContentId))}?titleExamId=${encodeURIComponent(String(exam.id))}&returnTo=%2Fmypage&start=1`,
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
      <div className="absolute inset-x-0 top-0 h-[262px] bg-[#c5d6ff]" />

      <header className="absolute inset-x-0 top-0 z-10 grid h-10 grid-cols-[24px_1fr_24px] items-center px-5">
        <span aria-hidden="true" />
        <h1 className="text-center text-[17px] leading-6 font-bold text-[#191f28]">
          마이
        </h1>
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
          aria-label="프로필 수정"
          className="relative size-[104px] rounded-[42px] p-1.5"
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
            <span className="absolute top-[89px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white bg-primary px-2.5 py-1 text-[11px] leading-[14px] font-bold text-white">
              {titleProgress.label}
            </span>
          ) : null}
        </Link>
        <h2 className="mt-5 text-[20px] leading-7 font-bold text-[#191f28]">
          {displayName ?? "불러오는 중…"}
        </h2>
        {statistics ? (
          <p className="mt-1 flex items-center gap-2 text-[13px] leading-[18px] font-medium text-[#3d4a5c]">
            <span>연속 {statistics.consecutiveLearningDays}일</span>
            <span className="h-2.5 w-px bg-[#8fa0bc]" />
            <span>총 {statistics.totalSessionCount}회 연습</span>
          </p>
        ) : (
          <p className="mt-1 text-[13px] leading-[18px] text-[#3d4a5c]">
            학습 기록을 불러오는 중
          </p>
        )}
      </section>

      <div className="absolute inset-x-0 top-[262px] bottom-0 overflow-y-auto overscroll-y-contain bg-[#f2f4f6]">
        <div className="bg-white px-5 pt-4">
          {titleProgress ? (
            <button
              type="button"
              disabled={!titleProgress.next?.eligible || examStarting}
              onClick={() => void startTitleExam()}
              className="flex min-h-[72px] w-full items-center rounded-[20px] bg-[#edf2ff] py-4 pr-4 pl-[18px] text-left disabled:opacity-100"
            >
              <span className="min-w-0 flex-1">
                <strong className="block text-[15px] leading-[22px] font-bold text-[#191f28]">
                  {titleProgress.next
                    ? titleProgress.next.eligible
                      ? "승급 시험 응시 가능"
                      : `연습 ${titleProgress.next.remainingTrainingCount}회 남았어요`
                    : `누적 ${titleProgress.completedTrainingCount}회 연습했어요`}
                </strong>
                <span className="mt-[3px] block text-[12px] leading-4 font-medium text-[#4e5968]">
                  {titleProgress.next
                    ? `다음 칭호  ${titleProgress.next.label}  `
                    : "최고 칭호"}
                  <b className="text-primary">
                    {titleProgress.completedTrainingCount}
                  </b>
                  <span className="text-[#8b95a1]">
                    /
                    {titleProgress.next?.requiredTrainingCount ??
                      titleProgress.completedTrainingCount}
                    회
                  </span>
                </span>
              </span>
              {titleProgress.next?.eligible ? (
                <span className="flex shrink-0 items-center gap-0.5 rounded-xl bg-primary px-3.5 py-2.5 text-[14px] leading-5 font-bold text-white">
                  {examStarting ? "준비 중" : "시험 보기"}
                  <Image
                    src="/figma/mypage/chevron-right-white.svg"
                    alt=""
                    width={20}
                    height={20}
                  />
                </span>
              ) : (
                <span className="shrink-0 text-[17px] leading-6 font-bold text-primary">
                  {percent}%
                </span>
              )}
            </button>
          ) : (
            <div className="h-[76px] animate-pulse rounded-2xl bg-[#edf2ff]" />
          )}

          <nav
            aria-label="마이페이지 메뉴"
            className="mt-3 grid h-11 grid-cols-3 border-b border-[#e5e8eb]"
          >
            <Link
              href="/mypage"
              aria-current="page"
              className="relative flex items-center justify-center text-[15px] font-bold text-[#191f28] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#191f28]"
            >
              요약
            </Link>
            <Link
              href="/mypage/history"
              className="flex items-center justify-center text-[15px] font-medium text-[#8b95a1]"
            >
              기록
            </Link>
            <Link
              href="/mypage/plan"
              className="flex items-center justify-center text-[15px] font-medium text-[#8b95a1]"
            >
              계획
            </Link>
          </nav>
        </div>

        <div className="space-y-3 px-5 pt-4 pb-6">
          {error ? (
            <p
              role="alert"
              className="rounded-2xl bg-white p-4 text-[13px] leading-[18px] text-destructive"
            >
              {error}
            </p>
          ) : null}

          <section className="rounded-2xl bg-white px-4 py-[18px]">
            <p className="text-[15px] leading-[22px] font-bold text-[#333d4b]">
              이번 달 연습 기록
            </p>
            <div className="mt-4 grid grid-cols-3 divide-x divide-[#e5e8eb] text-center">
              <Metric
                label="연습 횟수"
                value={`${statistics?.totalSessionCount ?? 0}회`}
              />
              <Metric label="연습 시간" value={learningTime} />
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

          <section className="rounded-2xl bg-white px-4 py-[18px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] leading-[22px] font-bold text-[#333d4b]">
                나의 발음 리포트
              </h2>
              <span className="text-[11px] leading-[14px] text-[#8b95a1]">
                이번 달 기준
              </span>
            </div>
            <div className="mt-4 space-y-4">
              <ReportRow
                title="잘하는 발음"
                items={(feedback?.strengths ?? []).map((item) => item.label)}
              />
              <ReportRow
                title="자주 틀리는 발음"
                items={(feedback?.weaknesses ?? []).map((item) => item.label)}
              />
              <ReportRow title="억양 특성" items={[]} unavailable />
            </div>
            <Link
              href="/class/pronunciation"
              className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-[#edf2ff] text-[14px] font-bold text-primary"
            >
              약점 집중 연습하기
              <Image
                src="/figma/mypage/chevron-right-blue.svg"
                alt=""
                width={20}
                height={20}
                className="ml-1"
              />
            </Link>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-1">
      <p className="truncate text-[17px] leading-6 font-bold text-[#191f28]">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-[14px] text-[#8b95a1]">{label}</p>
    </div>
  );
}

function ReportRow({
  title,
  items,
  unavailable = false,
}: {
  title: string;
  items: string[];
  unavailable?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <h3 className="shrink-0 pt-1 text-[13px] leading-[18px] text-[#6b7684]">
        {title}
      </h3>
      <div className="flex flex-wrap justify-end gap-1.5">
        {items.length ? (
          items.map((item) => (
            <span
              key={item}
              className="rounded-full bg-[#f2f4f6] px-2.5 py-1 text-[12px] leading-4 font-semibold text-[#333d4b]"
            >
              {item}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-[#f2f4f6] px-2.5 py-1 text-[12px] leading-4 text-[#8b95a1]">
            {unavailable ? "데이터 미제공" : "분석 기록 없음"}
          </span>
        )}
      </div>
    </div>
  );
}
