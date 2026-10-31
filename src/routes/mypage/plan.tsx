"use client";

import { prepareTitleExam, titleExamErrorMessage } from "@/lib/title-exam";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CompactCard, DetailedCard } from "@/components/plan-choice-card";
import { AppShell } from "@/components/app-shell";
import { MyPageHead, MyProfileBand } from "@/components/my-page-frame";
import layout from "@/components/my-page-layout.module.css";
import {
  api,
  type Statistics,
  type UserAccount,
  type UserTitleProgress,
} from "@/lib/api";
import { getCachedUser } from "@/lib/auth-session";
import {
  readMyPageOverviewCache,
  updateMyPageOverviewCache,
} from "@/lib/my-page-cache";
import {
  IMPROVEMENT_OPTIONS,
  METHOD_OPTIONS,
  PURPOSE_OPTIONS,
  SCHEDULE_OPTIONS,
  type EditSection,
} from "@/lib/onboarding-options";
import { useProfile, type OnboardingAnswers } from "@/lib/use-profile";
import { getUserTitleProgress } from "@/lib/user-title";
import { useHistoryPanel } from "@/hooks/use-history-panel";
import { navigationEntryId } from "@/lib/navigation-history";

function planSelection(draft: OnboardingAnswers | null, key: EditSection) {
  if (!draft) return [];
  return key === "purpose"
    ? draft.goals
    : key === "improvements"
      ? draft.improvementAreas
      : key === "methods"
        ? draft.learningSituations
        : [
            SCHEDULE_OPTIONS.find(
              (item) => item.weeklySessions === draft.weeklySessions,
            )?.value ?? "relaxed",
          ];
}

export default function PracticePlan() {
  const router = useRouter();
  const {
    profile,
    hydrated,
    error: loadError,
    reload,
    updatePlan,
  } = useProfile();
  const [initialOverview] = useState(readMyPageOverviewCache);
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [statistics, setStatistics] = useState<Statistics | null>(
    initialOverview?.statistics ?? null,
  );
  const [titleProgress, setTitleProgress] = useState<UserTitleProgress | null>(
    initialOverview?.titleProgress ?? null,
  );
  const [draft, setDraft] = useState<OnboardingAnswers | null>(null);
  const [editing, setEditing] = useHistoryPanel<EditSection>("edit", [
    "purpose",
    "improvements",
    "methods",
    "schedule",
  ]);
  const [selections, setSelections] = useState<
    Partial<Record<EditSection, string[]>>
  >({});
  const selection = editing
    ? (selections[editing] ?? planSelection(draft, editing))
    : [];
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [examStarting, setExamStarting] = useState(false);
  const examRequestKey = useRef<string | null>(null);
  const examRequestBusy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [weeklyDays, setWeeklyDays] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const localKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    api.myPage
      .listTrainingSessions({
        status: "COMPLETED",
        from: localKey(start),
        to: localKey(today),
        page: 0,
        size: 100,
      })
      .then((history) => {
        if (active)
          setWeeklyDays(
            new Set(
              history.items.map((item) => localKey(new Date(item.completedAt))),
            ).size,
          );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [retry]);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (profile) setDraft(profile);
  }, [profile]);

  useEffect(() => {
    let active = true;
    setOverviewLoading(true);
    void Promise.allSettled([
      api.users.getMe(),
      api.myPage.getStatistics({ period: "MONTH" }),
      api.users.getTitle(),
    ]).then(([userResult, statsResult, titleResult]) => {
      if (!active) return;
      setOverviewLoading(false);
      if (userResult.status === "fulfilled") {
        setAccount(userResult.value);
        updateMyPageOverviewCache({ nickname: userResult.value.nickname });
      }
      if (statsResult.status === "fulfilled") {
        setStatistics(statsResult.value);
        updateMyPageOverviewCache({ statistics: statsResult.value });
      }
      if (titleResult.status === "fulfilled") {
        setTitleProgress(titleResult.value);
        updateMyPageOverviewCache({ titleProgress: titleResult.value });
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
        updateMyPageOverviewCache({ titleProgress: fallback });
      }
    });
    return () => {
      active = false;
    };
  }, [initialOverview, retry]);

  useEffect(() => {
    if (editing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editing]);

  const options =
    editing === "purpose"
      ? PURPOSE_OPTIONS
      : editing === "improvements"
        ? IMPROVEMENT_OPTIONS.map((item) => ({
            value: item.value,
            title: item.value,
            description: "",
          }))
        : editing === "schedule"
          ? SCHEDULE_OPTIONS
          : METHOD_OPTIONS;

  const rows: Array<{ key: EditSection; label: string; value: string }> = draft
    ? [
        { key: "purpose", label: "목표", value: draft.goalDescription },
        {
          key: "schedule",
          label: "연습 일정",
          value:
            draft.weeklySessions === null
              ? "자유롭게"
              : `주 ${draft.weeklySessions}일`,
        },
        {
          key: "improvements",
          label: "집중할 부분",
          value: draft.improvementAreas
            .map(
              (value) =>
                IMPROVEMENT_OPTIONS.find((item) => item.value === value)
                  ?.summary ?? value,
            )
            .join(", "),
        },
        {
          key: "methods",
          label: "연습 방식",
          value: draft.learningSituations
            .map(
              (value) =>
                METHOD_OPTIONS.find((item) => item.value === value)?.summary ??
                value,
            )
            .join(", "),
        },
      ]
    : [];

  function open(key: EditSection) {
    if (!draft || busy.current) return;
    setSelections((current) => ({
      ...current,
      [key]: planSelection(draft, key),
    }));
    setError(null);
    setEditing(key);
  }

  async function apply() {
    if (!draft || !editing || !selection.length || busy.current) return;
    busy.current = true;
    const entry = navigationEntryId(window.history.state);
    const href = window.location.href;
    let value = { ...draft };
    if (editing === "purpose") {
      value = {
        ...value,
        goals: [selection[0] as OnboardingAnswers["goals"][number]],
        goalDescription:
          PURPOSE_OPTIONS.find((item) => item.value === selection[0])?.title ??
          draft.goalDescription,
      };
    }
    if (editing === "improvements") {
      value = {
        ...value,
        improvementAreas: selection,
        pronunciationConcerns: selection,
      };
    }
    if (editing === "methods") {
      value = { ...value, learningSituations: selection };
    }
    if (editing === "schedule") {
      const schedule = SCHEDULE_OPTIONS.find(
        (item) => item.value === selection[0],
      );
      value = {
        ...value,
        weeklySessions: schedule
          ? schedule.weeklySessions
          : draft.weeklySessions,
      };
    }

    setSaving(true);
    setError(null);
    try {
      await updatePlan(value);
      setDraft(value);
      if (
        href === window.location.href &&
        entry === navigationEntryId(window.history.state)
      ) {
        setEditing(null);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "계획을 저장하지 못했습니다.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
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
        await prepareTitleExam(api, "/mypage/plan", examRequestKey.current),
      );
    } catch (reason) {
      setError(titleExamErrorMessage(reason));
      setExamStarting(false);
      examRequestBusy.current = false;
    }
  }

  const canReload =
    Boolean(loadError) || (!overviewLoading && (!statistics || !titleProgress));

  return (
    <AppShell
      chromeColor="#ccdbff"
      viewportLocked
      className={`relative overflow-hidden bg-[#f2f4f6] ${layout.shell}`}
    >
      <div className={layout.content}>
        <MyProfileBand
          account={account}
          fallbackName={profile?.name}
          statistics={statistics}
          titleProgress={titleProgress}
          loading={overviewLoading}
        />
        <MyPageHead
          active="plan"
          loading={overviewLoading}
          titleProgress={titleProgress}
          examStarting={examStarting}
          onExam={() => void startTitleExam()}
        />
        <div className="px-5 pt-3.5 pb-6">
          <div className="mb-3 flex items-center justify-between pt-2 pl-1">
            <h2 className="text-[17px] leading-6 font-bold">내 연습 계획</h2>
            <button
              disabled={!draft}
              onClick={() => open("purpose")}
              className="rounded-full bg-white px-3 py-1.5 text-[13px] leading-[18px] text-[#4e5968]"
            >
              수정
            </button>
          </div>
          {!hydrated ? (
            <p className="rounded-[20px] bg-white py-12 text-center text-[13px] text-[#8b95a1]">
              계획을 불러오는 중…
            </p>
          ) : rows.length ? (
            <div className="rounded-[20px] bg-white pr-4 pl-5">
              {rows.map((row, index) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => open(row.key)}
                  className={`flex min-h-[76px] w-full items-center gap-3 py-[18px] text-left ${index < rows.length - 1 ? "border-b border-[#f2f4f6]" : ""}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#eaf0ff] text-sm font-bold text-primary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] leading-4 font-medium text-[#8b95a1]">
                      {row.label}
                    </span>
                    <strong className="mt-0.5 block truncate text-[15px] leading-[22px] font-bold text-[#191f28]">
                      {row.value || "선택해 주세요"}
                    </strong>
                  </span>
                  <Image
                    src="/figma/mypage-improved/row-chevron.svg"
                    alt=""
                    width={16}
                    height={16}
                  />
                </button>
              ))}
            </div>
          ) : null}
          {profile && weeklyDays !== null ? (
            <p className="mt-3 rounded-[16px] bg-[#eaf0ff] px-4 py-3.5 text-[13px] leading-[18px] text-[#2f4a8a]">
              {!profile.weeklySessions ? (
                "정해진 목표 없이 자유롭게 연습해요"
              ) : weeklyDays >= profile.weeklySessions ? (
                "이번 주 연습 계획을 달성했어요"
              ) : (
                <>
                  이번 주{" "}
                  <strong className="text-primary">
                    {profile.weeklySessions - weeklyDays}일
                  </strong>{" "}
                  더 연습하면 계획 달성이에요
                </>
              )}
            </p>
          ) : null}
          {error || canReload ? (
            <div className="mt-3 rounded-2xl bg-white p-4">
              <p role="alert" className="text-[13px] text-destructive">
                {error || loadError || "학습 정보를 모두 불러오지 못했어요."}
              </p>
              {canReload ? (
                <button
                  type="button"
                  disabled={overviewLoading || !hydrated}
                  onClick={() => {
                    setOverviewLoading(true);
                    setRetry((value) => value + 1);
                    reload();
                  }}
                  className="mt-1 min-h-11 px-2 text-sm font-semibold text-primary disabled:opacity-50"
                >
                  다시 시도
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <dialog
        aria-labelledby="plan-sheet-title"
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          setEditing(null);
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            setEditing(null);
          }
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[90dvh] w-full max-w-[402px] overflow-y-auto overscroll-contain rounded-t-[24px] border-0 bg-white px-6 pt-3 pb-[max(34px,env(safe-area-inset-bottom,0px))] text-[#191f28] backdrop:bg-[rgba(25,31,40,0.45)]"
      >
        <div
          className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#e5e8eb]"
          aria-hidden="true"
        />
        <div className="mb-5">
          <h2
            id="plan-sheet-title"
            className="text-[20px] leading-7 font-bold tracking-[-0.24px]"
          >
            {editing === "purpose"
              ? "무엇을 위해 연습하고 싶나요?"
              : editing === "improvements"
                ? "어떤 점을 개선하고 싶나요?"
                : editing === "schedule"
                  ? "일주일에 며칠 정도 연습할까요?"
                  : "어떤 방식으로 연습하고 싶나요?"}
          </h2>
          {editing === "improvements" || editing === "methods" ? (
            <p className="mt-1.5 text-[13px] leading-[18px] tracking-[0.2522px] text-[#8b95a1]">
              {editing === "improvements"
                ? "최대 3개까지 고를 수 있어요"
                : "여러 개를 골라도 돼요"}
            </p>
          ) : null}
        </div>
        <div className="space-y-2.5">
          {options.map((option) => {
            const selected = selection.includes(option.value);
            const onClick = () => {
              if (!editing || busy.current) return;
              const multi = editing === "improvements" || editing === "methods";
              setSelections((all) => {
                const current = all[editing] ?? planSelection(draft, editing);
                const next = multi
                  ? current.includes(option.value)
                    ? current.filter((value) => value !== option.value)
                    : editing === "improvements" && current.length >= 3
                      ? current
                      : [...current, option.value]
                  : [option.value];
                return { ...all, [editing]: next };
              });
            };
            return editing === "improvements" ? (
              <CompactCard
                key={option.value}
                title={option.title}
                selected={selected}
                disabled={saving}
                onClick={onClick}
                assetSet="mypage-plan"
              />
            ) : (
              <DetailedCard
                key={option.value}
                option={option}
                selected={selected}
                disabled={saving}
                onClick={onClick}
                assetSet="mypage-plan"
              />
            );
          })}
        </div>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!selection.length || saving}
          onClick={() => void apply()}
          className="mt-6 h-14 w-full rounded-full bg-primary text-[16px] font-bold text-white disabled:bg-[#dfe3e7]"
        >
          {saving ? "저장 중…" : "변경 저장"}
        </button>
      </dialog>
    </AppShell>
  );
}
