"use client";

import { AppShell } from "@/components/app-shell";
import { MyPageHead, MyProfileBandSkeleton } from "@/components/my-page-frame";
import layout from "@/components/my-page-layout.module.css";
import membership from "@/components/membership.module.css";
import { SkeletonBlock } from "@/components/skeleton-block";
import { HistoryListSkeleton } from "./history";

// Route-level placeholders: each one renders the destination's real chrome
// (header, tabs, bottom nav) and fills only the data areas with skeletons, so
// arriving on a screen never flashes a different layout.

function noop() {}

export function MyPageRouteSkeleton({
  active,
}: {
  active: "summary" | "plan";
}) {
  return (
    <AppShell chromeColor="#cdbfff" viewportLocked className={layout.shell}>
      <div className={layout.content} role="status" aria-busy="true">
        <span className="sr-only">마이페이지를 불러오는 중</span>
        <MyProfileBandSkeleton />
        <MyPageHead
          active={active}
          titleProgress={null}
          examStarting={false}
          onExam={noop}
          loading
        />
        {active === "summary" ? <SummarySkeleton /> : <PlanSkeleton />}
      </div>
    </AppShell>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-3 px-5 pt-4 pb-6" aria-hidden="true">
      <div className={`${layout.metrics} rounded-[16px] bg-[#f7f8fa] py-4`}>
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col items-center">
            <SkeletonBlock className="h-5 w-10 bg-white" />
            <SkeletonBlock className="mt-2 h-3 w-14 bg-white" />
          </div>
        ))}
      </div>
      <div className="rounded-[20px] bg-[#f7f8fa] p-5">
        <SkeletonBlock className="h-4 w-20 bg-white" />
        <SkeletonBlock className="mt-2 h-3 w-28 bg-white" />
        <div className="mt-6 flex h-[150px] items-end gap-2">
          {[45, 70, 55, 90, 65, 80, 100].map((height, index) => (
            <SkeletonBlock
              key={index}
              className="flex-1 rounded-[8px] bg-white"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-[20px] bg-[#f7f8fa] p-5">
        <SkeletonBlock className="h-4 w-16 bg-white" />
        {[0, 1, 2].map((index) => (
          <div key={index} className="mt-4 flex items-center gap-2">
            <SkeletonBlock className="h-3.5 w-24 bg-white" />
            <SkeletonBlock className="ml-auto h-6 w-14 bg-white" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div className="px-5 pt-1 pb-6" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between pt-2">
        <SkeletonBlock className="h-5 w-24" />
        <SkeletonBlock className="h-[30px] w-12" />
      </div>
      <div className="rounded-[20px] bg-[#f7f8fa] py-1 pr-4 pl-5">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="flex min-h-[68px] items-center gap-3 py-3.5"
          >
            <SkeletonBlock className="size-8 shrink-0 rounded-[10px] bg-white" />
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-3 w-12 bg-white" />
              <SkeletonBlock className="mt-2 h-4 w-3/5 bg-white" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const HISTORY_FILTERS = [
  "전체",
  "뉴스",
  "문장",
  "아나운서",
  "내 문장",
  "클래스",
];

export function HistoryRouteSkeleton() {
  return (
    <AppShell
      chromeColor="#ffffff"
      viewportLocked
      className="relative flex flex-col overflow-hidden bg-white [--primary:#6346f6]"
    >
      <header className="flex h-[52px] shrink-0 items-center px-5 py-2">
        <h1 className="w-full text-center text-[17px] leading-6 font-bold text-[#191f28]">
          기록
        </h1>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden px-5 pb-6">
        <div
          aria-hidden="true"
          className="-mx-5 flex gap-5 overflow-hidden border-b border-[#f2f4f6] px-5 pt-3"
        >
          {HISTORY_FILTERS.map((label, index) => (
            <span
              key={label}
              className={`shrink-0 border-b-2 pb-2.5 text-[15px] leading-[18px] font-medium ${index === 0 ? "border-[#191f28] font-bold text-[#191f28]" : "border-transparent text-[#8b95a1]"}`}
            >
              {label}
            </span>
          ))}
        </div>
        <HistoryListSkeleton />
      </div>
    </AppShell>
  );
}

export function PaymentsRouteSkeleton() {
  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#fff"
      className="overflow-hidden bg-white text-[#191f28]"
    >
      <div role="status" aria-busy="true">
        <span className="sr-only">결제 정보를 불러오는 중</span>
        <header className={membership.nav} aria-hidden="true">
          <SkeletonBlock className="size-6" />
          <SkeletonBlock className="mx-auto h-5 w-20" />
          <span />
        </header>
        <div className={membership.month} aria-hidden="true">
          <SkeletonBlock className="h-[18px] w-16" />
        </div>
        {[0, 1, 2].map((index) => (
          <div key={index} className={membership.historyRow} aria-hidden="true">
            <span>
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="mt-2 h-3 w-20" />
            </span>
            <span className="flex flex-col items-end">
              <SkeletonBlock className="h-4 w-16" />
              <SkeletonBlock className="mt-2 h-3 w-10" />
            </span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

export function SettingsRouteSkeleton() {
  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#ffffff"
      className="flex flex-col overflow-hidden bg-white"
    >
      <header className="relative flex h-12 shrink-0 items-center px-2 py-1">
        <span className="size-10" />
        <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold">
          설정
        </h1>
      </header>
      <div role="status" aria-busy="true" className="pb-6">
        <span className="sr-only">설정을 불러오는 중</span>
        {[1, 2, 2].map((rows, section) => (
          <section key={section} aria-hidden="true">
            <div className="h-8 px-5 py-2">
              <SkeletonBlock className="h-3 w-14" />
            </div>
            {Array.from({ length: rows }, (_, index) => (
              <div
                key={index}
                className="flex h-14 items-center gap-3.5 px-5 py-2"
              >
                <SkeletonBlock className="size-9 shrink-0" />
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="ml-auto h-4 w-4" />
              </div>
            ))}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
