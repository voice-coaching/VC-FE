"use client";

import Image from "next/image";
import Link from "next/link";
import { NicknameEditor } from "@/components/nickname-editor";
import type { Statistics, UserAccount, UserTitleProgress } from "@/lib/api";
import { USER_TITLE_LEVELS } from "@/lib/user-title";
import styles from "./my-page-layout.module.css";

const titleLabels = [
  "왕초보",
  "또박 초보",
  "술술 중수",
  "또렷 고수",
  "아나운서",
];
function levelOf(progress: UserTitleProgress | null) {
  return (
    Math.max(
      0,
      USER_TITLE_LEVELS.findIndex((item) => item.code === progress?.code),
    ) + 1
  );
}

export function MyProfileBand({
  account,
  fallbackName,
  titleProgress,
  loading,
}: {
  account: UserAccount | null;
  fallbackName?: string;
  statistics: Statistics | null;
  titleProgress: UserTitleProgress | null;
  loading: boolean;
}) {
  const level = levelOf(titleProgress);
  return (
    <div
      className={styles.profileBand}
      data-highest={titleProgress?.next === null}
    >
      <header className="grid h-10 grid-cols-[24px_1fr_24px] items-center px-5">
        <span />
        <h1 className="text-center text-[17px] leading-6 font-bold">마이</h1>
        <Link
          href="/mypage/settings"
          aria-label="설정"
          className="flex size-10 -translate-x-2 items-center justify-center"
        >
          <Image
            src="/figma/mypage-improved/settings.svg"
            alt=""
            width={24}
            height={24}
          />
        </Link>
      </header>
      <section className={styles.profile} aria-label="내 프로필">
        <div className={styles.avatar}>
          <Image
            src={`/figma/mypage-improved/disc-${level}.svg`}
            alt=""
            width={104}
            height={104}
            className="absolute inset-0"
          />
          {level > 1 ? (
            <Image
              src={`/figma/mypage-improved/track-${level}.svg`}
              alt=""
              width={104}
              height={104}
              className="absolute inset-0"
            />
          ) : null}
          <Image
            src={`/figma/mypage-improved/ring-${level}.svg`}
            alt=""
            width={104}
            height={104}
            className="absolute inset-0"
          />
          <span className={styles.avatarInner}>
            <span className={styles.avatarCrop}>
              <Image
                src="/figma/mypage-improved/avatar.png"
                alt="Speak AI 캐릭터"
                width={130}
                height={131}
                priority
                className={styles.character}
              />
            </span>
          </span>
        </div>
        <div className="flex max-w-full flex-col items-center gap-1.5 pt-1">
          <span className={styles.titleBadge} data-level={level}>
            <b>Lv.{level}</b>
            <span>
              {titleProgress
                ? titleLabels[level - 1]
                : loading
                  ? "불러오는 중"
                  : "칭호 확인 필요"}
            </span>
          </span>
          <NicknameEditor
            account={account}
            fallbackName={fallbackName}
            compact
          />
        </div>
      </section>
    </div>
  );
}

export function MyPageHead({
  active,
  titleProgress,
  examStarting,
  onExam,
  loading,
}: {
  active: "summary" | "plan";
  titleProgress: UserTitleProgress | null;
  examStarting: boolean;
  onExam: () => void;
  loading: boolean;
}) {
  const next = titleProgress?.next;
  const nextLevel = Math.min(5, levelOf(titleProgress) + 1);
  return (
    <>
      {next ? (
        <div className={styles.promotionWrap}>
          <section className={styles.promotion} aria-label="승급 시험">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] leading-[22px] font-bold">
                {titleLabels[nextLevel - 1]} 승급 시험
              </h2>
              <p className="mt-[3px] text-xs leading-4 font-medium text-[#4e5968]">
                {next.eligible
                  ? `시험 문장 발음 ${next.passingScore}점 이상이면 통과`
                  : `시험까지 연습 ${next.remainingTrainingCount}회 남았어요`}
              </p>
            </div>
            <button
              type="button"
              onClick={onExam}
              disabled={!next.eligible || examStarting}
              className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-3.5 py-2.5 text-sm leading-5 font-bold text-white disabled:opacity-45"
            >
              {examStarting ? "준비 중" : "시험 보기"}
              <Image
                src="/figma/mypage-improved/exam-chevron.svg"
                alt=""
                width={16}
                height={16}
              />
            </button>
          </section>
        </div>
      ) : !titleProgress ? (
        <div className={styles.promotionWrap}>
          <p
            className={`${styles.promotion} justify-center text-sm text-[#6b7684]`}
          >
            {loading ? "칭호를 불러오는 중…" : "칭호 정보를 확인하지 못했어요"}
          </p>
        </div>
      ) : null}
      <nav aria-label="마이페이지 메뉴" className={styles.tabs}>
        {[
          ["summary", "/mypage", "요약"],
          ["plan", "/mypage/plan", "계획"],
        ].map(([key, href, label]) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
