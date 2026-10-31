"use client";

import { prepareTitleExam, titleExamErrorMessage } from "@/lib/title-exam";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MyProfileBand, MyPageHead } from "@/components/my-page-frame";
import { MyGrowthChart } from "@/components/my-growth-chart";
import layout from "@/components/my-page-layout.module.css";
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

export default function MyPage() {
  const router = useRouter();
  const [initialOverview] = useState(readMyPageOverviewCache);
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [statistics, setStatistics] = useState<Statistics | null>(
    initialOverview?.statistics ?? null,
  );
  const [lifetimeStatistics, setLifetimeStatistics] =
    useState<Statistics | null>(null);
  const [feedback, setFeedback] = useState<StrengthsWeaknesses | null>(
    initialOverview?.feedback ?? null,
  );
  const [titleProgress, setTitleProgress] = useState<UserTitleProgress | null>(
    initialOverview?.titleProgress ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [examStarting, setExamStarting] = useState(false);
  const examRequestKey = useRef<string | null>(null);
  const examRequestBusy = useRef(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const cachedUser = getCachedUser();
    void Promise.allSettled([
      cachedUser ? Promise.resolve(cachedUser) : api.users.getMe(),
      api.myPage.getStatistics({ period: "MONTH" }),
      api.myPage.getStrengthsWeaknesses({ period: "MONTH", limit: 5 }),
      api.users.getTitle(),
      api.myPage.getStatistics({ period: "ALL" }),
    ]).then(
      ([
        userResult,
        statsResult,
        feedbackResult,
        titleResult,
        lifetimeResult,
      ]) => {
        if (!active) return;
        setLoading(false);
        if (lifetimeResult.status === "fulfilled")
          setLifetimeStatistics(lifetimeResult.value);
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
          // Only the title API can grant exam eligibility.
          if (fallback.next) fallback.next.eligible = false;
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
              : feedbackResult.status === "rejected" &&
                  !initialOverview?.feedback
                ? feedbackResult
                : null;
        if (firstUncoveredFailure) {
          setError(
            firstUncoveredFailure.reason instanceof Error
              ? firstUncoveredFailure.reason.message
              : "마이페이지를 불러오지 못했습니다.",
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [initialOverview, retry]);

  const totalSeconds = lifetimeStatistics?.totalLearningSeconds ?? 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const learningTime = hours ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  async function startTitleExam() {
    if (examRequestBusy.current) return;
    examRequestBusy.current = true;
    examRequestKey.current ??= crypto.randomUUID();
    setExamStarting(true);
    setError(null);
    try {
      router.push(
        await prepareTitleExam(api, "/mypage", examRequestKey.current),
      );
    } catch (reason) {
      setError(titleExamErrorMessage(reason));
      setExamStarting(false);
      examRequestBusy.current = false;
    }
  }

  return (
    <AppShell chromeColor="#ccdbff" viewportLocked className={layout.shell}>
      <div className={layout.content}>
        <MyProfileBand
          account={account}
          fallbackName={initialOverview?.nickname}
          statistics={statistics}
          titleProgress={titleProgress}
          loading={loading}
        />
        <MyPageHead
          active="summary"
          titleProgress={titleProgress}
          examStarting={examStarting}
          onExam={() => void startTitleExam()}
          loading={loading}
        />
        <div className="space-y-3 px-5 pt-3 pb-6">
          {error ? (
            <div className="rounded-2xl bg-white p-4 text-[13px] leading-[18px] text-destructive">
              <p role="alert">{error}</p>
              {!statistics || !feedback || !titleProgress ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setLoading(true);
                    setRetry((value) => value + 1);
                  }}
                  className="mt-1 min-h-11 px-2 text-sm font-semibold text-primary disabled:opacity-50"
                >
                  다시 시도
                </button>
              ) : null}
            </div>
          ) : null}

          <section className="rounded-[20px] bg-white py-4">
            <div className="grid grid-cols-3 divide-x divide-[#f2f4f6] text-center">
              <Metric
                label="연습 횟수"
                value={
                  lifetimeStatistics
                    ? `${lifetimeStatistics.totalSessionCount}회`
                    : "—"
                }
              />
              <Metric
                label="누적 연습 시간"
                value={lifetimeStatistics ? learningTime : "—"}
              />
              <Metric
                label="평균 점수"
                value={
                  lifetimeStatistics?.totalSessionCount
                    ? `${Math.round(lifetimeStatistics.averageOverallScore)}점`
                    : "—"
                }
              />
            </div>
          </section>

          <MyGrowthChart />

          <section className="rounded-[20px] bg-white p-[18px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] leading-[22px] font-bold text-[#333d4b]">
                내 리포트
              </h2>
              <span className="text-[11px] leading-[14px] text-[#8b95a1]">
                이번 달 기준
              </span>
            </div>
            <div className="mt-3.5 space-y-3.5">
              <ReportRow
                title="잘하는 발음"
                tone="strength"
                items={(feedback?.strengths ?? []).map((item) => item.label)}
                pending={loading && !feedback}
                failed={!loading && !feedback}
              />
              <ReportRow
                title="자주 틀리는 발음"
                tone="weakness"
                items={(feedback?.weaknesses ?? []).map((item) => item.label)}
                pending={loading && !feedback}
                failed={!loading && !feedback}
              />
              <ReportRow
                tone="intonation"
                title="억양 특성"
                items={[]}
                unavailable
              />
            </div>
            <Link
              href="/class/pronunciation"
              className="mt-3.5 flex min-h-11 items-center justify-center rounded-full bg-[#eaf0ff] text-[14px] font-bold text-primary"
            >
              약점 집중 연습하기
              <Image
                src="/figma/mypage-improved/practice-chevron.svg"
                alt=""
                width={16}
                height={16}
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
      <p className="mt-1 text-xs leading-4 text-[#8b95a1]">{label}</p>
    </div>
  );
}

function ReportRow({
  title,
  tone,
  items,
  unavailable = false,
  pending = false,
  failed = false,
}: {
  title: string;
  tone: "strength" | "weakness" | "intonation";
  items: string[];
  unavailable?: boolean;
  pending?: boolean;
  failed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex shrink-0 items-center gap-1.5 text-[13px] leading-[18px] text-[#4e5968]">
        <span className="relative size-4">
          <Image
            src={`/figma/mypage-improved/${tone}.svg`}
            alt=""
            width={
              tone === "strength" ? 25.1309 : tone === "weakness" ? 28.9157 : 18
            }
            height={
              tone === "strength"
                ? 25.1309
                : tone === "weakness"
                  ? 28.9157
                  : 14.625
            }
            className="absolute max-w-none"
            style={{
              left:
                tone === "strength" ? -4.82 : tone === "weakness" ? -6.51 : 0,
              top:
                tone === "strength"
                  ? -5.03
                  : tone === "weakness"
                    ? -6.46
                    : 0.69,
            }}
          />
        </span>
        {title}
      </h3>
      <div className="flex flex-wrap justify-end gap-1.5">
        {items.length ? (
          items.map((item) => (
            <span
              key={item}
              className={`rounded-full px-2 py-[3px] text-xs leading-4 font-medium ${tone === "strength" ? "bg-[#e6f7ee] text-[#0e7a47]" : tone === "weakness" ? "bg-[#ffedef] text-[#f04452]" : "bg-[#eaf0ff] text-primary"}`}
            >
              {item}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-[#f2f4f6] px-2.5 py-1 text-[12px] leading-4 text-[#8b95a1]">
            {pending
              ? "불러오는 중"
              : failed
                ? "불러오기 실패"
                : unavailable
                  ? "데이터 미제공"
                  : "분석 기록 없음"}
          </span>
        )}
      </div>
    </div>
  );
}
