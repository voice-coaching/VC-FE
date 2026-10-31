"use client";

import { prepareTitleExam, titleExamErrorMessage } from "@/lib/title-exam";

import Image from "next/image";
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
import { weaknessPracticeHref } from "@/lib/weakness-practice";
import { lifetimeStatisticsFilters } from "@/lib/my-page-queries";

export default function MyPage() {
  const router = useRouter();
  const [initialOverview] = useState(readMyPageOverviewCache);
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [statistics, setStatistics] = useState<Statistics | null>(
    initialOverview?.statistics ?? null,
  );
  const [lifetimeStatistics, setLifetimeStatistics] =
    useState<Statistics | null>(initialOverview?.lifetimeStatistics ?? null);
  const [feedback, setFeedback] = useState<StrengthsWeaknesses | null>(
    initialOverview?.feedback ?? null,
  );
  const [titleProgress, setTitleProgress] = useState<UserTitleProgress | null>(
    initialOverview?.titleProgress ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [examStarting, setExamStarting] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const recommendationBusy = useRef(false);
  const examRequestKey = useRef<string | null>(null);
  const examRequestBusy = useRef(false);
  const [loading, setLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(
    !initialOverview?.feedback,
  );
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let identityPending = 2;
    setLoading(true);
    setFeedbackLoading(!initialOverview?.feedback);
    setError(null);
    const cachedUser = getCachedUser();
    const identitySettled = () => {
      identityPending -= 1;
      if (identityPending === 0) setLoading(false);
    };
    const watch = <T,>(
      request: Promise<T>,
      apply: (value: T) => void,
      covered: boolean,
      settled?: () => void,
    ) => {
      void request
        .then((value) => {
          if (active) apply(value);
        })
        .catch((reason: unknown) => {
          if (!active || covered) return;
          setError(
            (current) =>
              current ??
              (reason instanceof Error
                ? reason.message
                : "마이페이지를 불러오지 못했습니다."),
          );
        })
        .finally(() => {
          if (active) settled?.();
        });
    };
    const userRequest = api.users.getMe();
    const statsRequest = api.myPage.getStatistics({ period: "MONTH" });
    const titleRequest = api.users.getTitle();
    watch(
      userRequest,
      (user) => {
        setAccount(user);
        updateMyPageOverviewCache({ nickname: user.nickname });
      },
      Boolean(cachedUser || initialOverview?.nickname),
      identitySettled,
    );
    watch(
      titleRequest,
      (value) => {
        setTitleProgress(value);
        updateMyPageOverviewCache({ titleProgress: value });
      },
      false,
      identitySettled,
    );
    watch(
      statsRequest,
      (value) => {
        setStatistics(value);
        updateMyPageOverviewCache({ statistics: value });
      },
      Boolean(initialOverview?.statistics),
    );
    watch(
      api.myPage.getStrengthsWeaknesses({ period: "MONTH", limit: 5 }),
      (value) => {
        setFeedback(value);
        updateMyPageOverviewCache({ feedback: value });
      },
      Boolean(initialOverview?.feedback),
      () => setFeedbackLoading(false),
    );
    // Signup time is immutable; the session gate's user can start this request
    // while the profile revalidates instead of adding another network roundtrip.
    const lifetimeRequest = (
      cachedUser ? Promise.resolve(cachedUser) : userRequest
    ).then((user) =>
      api.myPage.getStatistics(lifetimeStatisticsFilters(user.createdAt)),
    );
    watch(
      lifetimeRequest,
      (value) => {
        setLifetimeStatistics(value);
        updateMyPageOverviewCache({ lifetimeStatistics: value });
      },
      Boolean(initialOverview?.lifetimeStatistics),
    );
    void titleRequest.catch(() => {
      if (!active || initialOverview?.titleProgress) return;
      void statsRequest
        .then((value) => {
          if (!active) return;
          const fallback = getUserTitleProgress(
            "ABSOLUTE_BEGINNER",
            value.totalSessionCount,
          );
          if (fallback.next) fallback.next.eligible = false;
          setTitleProgress(fallback);
          updateMyPageOverviewCache({ titleProgress: fallback });
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
    };
  }, [initialOverview, retry]);

  const totalSeconds = lifetimeStatistics?.totalLearningSeconds ?? 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const learningTime = hours ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  async function startWeaknessPractice() {
    if (recommendationBusy.current) return;
    recommendationBusy.current = true;
    setRecommendationLoading(true);
    setError(null);
    try {
      router.push(await weaknessPracticeHref(api));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "추천 연습을 불러오지 못했어요.",
      );
    } finally {
      recommendationBusy.current = false;
      setRecommendationLoading(false);
    }
  }

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
          showMembership
          account={account}
          fallbackName={initialOverview?.nickname}
          statistics={statistics}
          titleProgress={titleProgress}
          loading={loading}
        />
        <MyPageHead
          showMembership
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
            </div>
          ) : null}

          <section className="rounded-[20px] bg-white py-4">
            <div className={layout.metrics}>
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
              <h2 className="text-[15px] leading-[22px] font-bold text-[#191f28]">
                내 리포트
              </h2>
              <span className="text-[12px] leading-4 font-medium text-[#8b95a1]">
                이번 달 기준
              </span>
            </div>
            <div className="mt-3.5 space-y-3.5">
              <ReportRow
                title="잘하는 발음"
                tone="strength"
                items={(feedback?.strengths ?? []).map((item) => item.label)}
                pending={feedbackLoading && !feedback}
                failed={!feedbackLoading && !feedback}
              />
              <ReportRow
                title="자주 틀리는 발음"
                tone="weakness"
                items={(feedback?.weaknesses ?? []).map((item) => item.label)}
                pending={feedbackLoading && !feedback}
                failed={!feedbackLoading && !feedback}
              />
              <ReportRow
                tone="intonation"
                title="억양 특성"
                items={[]}
                unavailable
              />
            </div>
            <button
              type="button"
              disabled={recommendationLoading}
              onClick={() => void startWeaknessPractice()}
              className="mt-3.5 flex min-h-11 w-full items-center justify-center rounded-full bg-[#eaf0ff] text-[14px] font-bold text-primary disabled:opacity-50"
            >
              {recommendationLoading
                ? "추천 연습 찾는 중…"
                : "약점 집중 연습하기"}
              <Image
                src="/figma/mypage-improved/practice-chevron.svg"
                alt=""
                width={16}
                height={16}
                className="ml-1"
              />
            </button>
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
      <p className="mt-1 text-xs leading-4 font-medium text-[#8b95a1]">
        {label}
      </p>
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
                    ? -7.13
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
              className={`rounded-full px-2 py-[3px] text-xs leading-4 font-medium ${tone === "strength" ? "bg-[#e6f7ee] text-[#0e7a47]" : tone === "weakness" ? "bg-[#ffedee] text-[#c9303d]" : "bg-[#eaf0ff] text-primary"}`}
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
