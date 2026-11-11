"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { NicknameEditor } from "@/components/nickname-editor";
import { MembershipCard } from "@/components/membership-card";
import { SkeletonBlock } from "@/components/skeleton-block";
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
  showMembership = false,
}: {
  account: UserAccount | null;
  fallbackName?: string;
  statistics: Statistics | null;
  titleProgress: UserTitleProgress | null;
  loading: boolean;
  showMembership?: boolean;
}) {
  const level = levelOf(titleProgress);
  return (
    <div
      className={styles.profileBand}
      data-highest={titleProgress?.next === null}
      data-membership={showMembership}
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
            src="/figma/mypage-purple/settings.svg"
            alt=""
            width={24}
            height={24}
          />
        </Link>
      </header>
      <section className={styles.profile} aria-label="내 프로필">
        <div className={styles.avatar}>
          {level > 1 ? <ProfileWings level={level} /> : null}
          <Image
            src={`/figma/mypage-purple/disc-${level}.svg`}
            alt=""
            width={104}
            height={104}
            className="absolute inset-0"
          />
          {level > 1 ? (
            <Image
              src={`/figma/mypage-purple/track-${level}.svg`}
              alt=""
              width={104}
              height={104}
              className="absolute inset-0"
            />
          ) : null}
          <Image
            src={`/figma/mypage-purple/ring-${level}.svg`}
            alt=""
            width={104}
            height={104}
            className="absolute inset-0"
          />
          <span className={styles.avatarInner}>
            <span className={styles.avatarCrop}>
              <Image
                src={`/figma/mypage-purple/avatar-${level}.png`}
                alt="Speak AI 캐릭터"
                width={117}
                height={117}
                priority
                className={styles.character}
              />
            </span>
          </span>
        </div>
        <div className="flex max-w-full flex-col items-center gap-1.5 pt-1">
          {!titleProgress && loading ? (
            <SkeletonBlock className="h-6 w-[88px] bg-white/60" />
          ) : (
            <span className={styles.titleBadge} data-level={level}>
              <b>Lv.{level}</b>
              <span>
                {titleProgress ? titleLabels[level - 1] : "칭호 확인 필요"}
              </span>
            </span>
          )}
          <NicknameEditor
            account={account}
            fallbackName={fallbackName}
            compact
          />
        </div>
        {showMembership ? <MembershipCard account={account} /> : null}
      </section>
    </div>
  );
}

// Figma Wings variants sit behind the 104px ring in a 168 × 71px slot.
const wings = [
  { left: 24.0072, right: 105, top: 30.9986, width: 38.9991, height: 36.3744 },
  {
    left: 14.2464,
    right: 105,
    top: 21.4349,
    width: 48.7495,
    rightHeight: 45.9433,
    height: 45.9429,
  },
  {
    left: 5.4768,
    right: 105,
    top: 13.1634,
    width: 57.5244,
    rightWidth: 57.5248,
    rightHeight: 54.2123,
    height: 54.2132,
  },
  {
    left: 4.5024,
    right: 105,
    top: 11.4736,
    width: 58.5,
    rightWidth: 58.4994,
    rightHeight: 55.9034,
    height: 55.9025,
  },
  { left: 0.8064, right: 91.0056, top: 0, width: 76.2002, height: 70.3219 },
];

function ProfileWings({ level }: { level: number }) {
  const wing = wings[level - 1];
  return (
    <span className={styles.wings} aria-hidden="true">
      <Image
        src={`/figma/mypage-purple/wing-${level}-left.svg`}
        alt=""
        width={wing.width}
        height={wing.height}
        style={{ left: wing.left, top: wing.top }}
      />
      <Image
        src={`/figma/mypage-purple/wing-${level}-right.svg`}
        alt=""
        width={wing.rightWidth ?? wing.width}
        height={wing.rightHeight ?? wing.height}
        className={styles.wingRight}
        style={{ left: wing.right, top: wing.top }}
      />
    </span>
  );
}

export function MyPageHead({
  active,
  titleProgress,
  examStarting,
  onExam,
  loading,
  showMembership = false,
}: {
  active: "summary" | "plan";
  titleProgress: UserTitleProgress | null;
  examStarting: boolean;
  onExam: () => void;
  loading: boolean;
  showMembership?: boolean;
}) {
  const next = titleProgress?.next;
  return (
    <>
      {next ? (
        <div className={styles.promotionWrap}>
          <section
            className={styles.promotion}
            data-membership={showMembership}
            aria-label="승급 시험"
          >
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] leading-[22px] font-bold">
                {
                  titleLabels[
                    USER_TITLE_LEVELS.findIndex(
                      (item) => item.code === next.code,
                    )
                  ]
                }{" "}
                승급 시험
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
              className={`flex shrink-0 items-center gap-0.5 rounded-full px-3.5 py-2.5 text-sm leading-5 font-bold disabled:opacity-45 ${showMembership ? "bg-[#eeeaff] text-primary" : "bg-primary text-white"}`}
            >
              {examStarting ? "준비 중" : "시험 보기"}
              <Image
                src={
                  showMembership
                    ? "/figma/mypage-improved/exam-chevron.svg"
                    : "/figma/mypage-improved/exam-chevron-white.svg"
                }
                alt=""
                width={16}
                height={16}
              />
            </button>
          </section>
        </div>
      ) : !titleProgress && loading ? (
        <PromotionSkeleton />
      ) : !titleProgress ? (
        <div className={styles.promotionWrap}>
          <p
            className={`${styles.promotion} justify-center text-sm text-[#6b7684]`}
          >
            칭호 정보를 확인하지 못했어요
          </p>
        </div>
      ) : null}
      <MyPageTabs active={active} />
    </>
  );
}

function PromotionSkeleton() {
  return (
    <div
      className={styles.promotionWrap}
      role="status"
      aria-label="칭호를 불러오는 중"
    >
      <div className={styles.promotion}>
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="mt-2 h-3 w-44" />
        </div>
        <SkeletonBlock className="h-10 w-[92px] shrink-0" />
      </div>
    </div>
  );
}

/** Profile band placeholder for route fallbacks (no nickname editor/hooks). */
export function MyProfileBandSkeleton() {
  return (
    <div className={styles.profileBand} aria-hidden="true">
      <header className="grid h-10 grid-cols-[24px_1fr_24px] items-center px-5">
        <span />
        <h1 className="text-center text-[17px] leading-6 font-bold">마이</h1>
        <span />
      </header>
      <section className={styles.profile}>
        <SkeletonBlock className="size-[104px] bg-white/60" />
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <SkeletonBlock className="h-6 w-[88px] bg-white/60" />
          <SkeletonBlock className="h-7 w-24 bg-white/60" />
        </div>
      </section>
    </div>
  );
}

const MY_TABS = [
  ["summary", "/mypage", "요약"],
  ["plan", "/mypage/plan", "계획"],
] as const;
// Survives the route change between tabs, so the underline can start from
// where it was instead of appearing under the new tab.
let lastTab: string | null = null;

/** Summary / plan tabs with an underline that slides between them. */
function MyPageTabs({ active }: { active: string }) {
  const nav = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  useLayoutEffect(() => {
    const element = nav.current;
    if (!element) return;
    const measure = (key: string) => {
      const link = element.querySelector<HTMLElement>(`[data-tab="${key}"]`);
      return link ? { left: link.offsetLeft, width: link.offsetWidth } : null;
    };
    const target = measure(active);
    const from = lastTab && lastTab !== active ? measure(lastTab) : null;
    lastTab = active;
    if (
      from &&
      target &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setAnimate(false);
      setBar(from);
      const frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setAnimate(true);
          setBar(target);
        }),
      );
      return () => cancelAnimationFrame(frame);
    }
    setBar(target);
  }, [active]);
  return (
    <nav ref={nav} aria-label="마이페이지 메뉴" className={styles.tabs}>
      {MY_TABS.map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          data-tab={key}
          aria-current={active === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
      {bar && (
        <span
          aria-hidden="true"
          className={styles.tabBar}
          data-animate={animate}
          style={{ transform: `translateX(${bar.left}px)`, width: bar.width }}
        />
      )}
    </nav>
  );
}
