"use client";

import Image from "next/image";
import Link from "next/link";
import type { Statistics, UserAccount, UserTitleProgress } from "@/lib/api";
import { cn } from "@/lib/utils";

export function MyProfileBand({
  account,
  fallbackName,
  statistics,
  titleProgress,
}: {
  account: UserAccount | null;
  fallbackName?: string;
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
        <span aria-hidden="true" />
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
          {account?.nickname ?? fallbackName ?? "불러오는 중…"}
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
    </>
  );
}

export function MyPageHead({
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
