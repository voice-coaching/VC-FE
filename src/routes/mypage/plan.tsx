"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MyPageHead, MyProfileBand } from "@/components/my-page-frame";
import {
  api,
  type Statistics,
  type UserAccount,
  type UserTitleProgress,
} from "@/lib/api";
import { getCachedUser } from "@/lib/auth-session";
import {
  IMPROVEMENT_OPTIONS,
  METHOD_OPTIONS,
  PURPOSE_OPTIONS,
  SCHEDULE_OPTIONS,
  type EditSection,
} from "@/lib/onboarding-options";
import { useProfile, type OnboardingAnswers } from "@/lib/use-profile";
import { getUserTitleProgress } from "@/lib/user-title";

export default function PracticePlan() {
  const router = useRouter();
  const { profile, hydrated, error: loadError, updatePlan } = useProfile();
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [titleProgress, setTitleProgress] = useState<UserTitleProgress | null>(
    null,
  );
  const [draft, setDraft] = useState<OnboardingAnswers | null>(null);
  const [editing, setEditing] = useState<EditSection | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [examStarting, setExamStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (profile) setDraft(profile);
  }, [profile]);

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
          value: `주 ${draft.weeklySessions}일`,
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
    if (!draft) return;
    setSelection(
      key === "purpose"
        ? draft.goals
        : key === "improvements"
          ? draft.improvementAreas
          : key === "methods"
            ? draft.learningSituations
            : [
                SCHEDULE_OPTIONS.find(
                  (item) => item.weeklySessions === draft.weeklySessions,
                )?.value ?? "relaxed",
              ],
    );
    setEditing(key);
  }

  async function apply() {
    if (!draft || !selection.length) return;
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
      value = {
        ...value,
        weeklySessions:
          SCHEDULE_OPTIONS.find((item) => item.value === selection[0])
            ?.weeklySessions ?? draft.weeklySessions,
      };
    }

    setSaving(true);
    setError(null);
    try {
      await updatePlan(value);
      setDraft(value);
      setEditing(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "계획을 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function startTitleExam() {
    setExamStarting(true);
    setError(null);
    try {
      const exam = await api.users.createTitleExam();
      router.push(
        `/practice/${encodeURIComponent(String(exam.practiceContentId))}?titleExamId=${encodeURIComponent(String(exam.id))}&returnTo=%2Fmypage%2Fplan&start=1`,
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
      <MyProfileBand
        account={account}
        fallbackName={profile?.name}
        statistics={statistics}
        titleProgress={titleProgress}
      />
      <div className="absolute inset-x-0 top-[262px] bottom-0 overflow-y-auto overscroll-y-contain bg-[#f2f4f6]">
        <MyPageHead
          active="plan"
          titleProgress={titleProgress}
          examStarting={examStarting}
          onExam={() => void startTitleExam()}
        />
        <div className="px-5 pt-3.5 pb-6">
          <h2 className="px-1 pb-4 text-[20px] leading-7 font-bold">
            내 연습 계획
          </h2>
          {!hydrated ? (
            <p className="rounded-[20px] bg-white py-12 text-center text-[13px] text-[#8b95a1]">
              계획을 불러오는 중…
            </p>
          ) : (
            <div className="rounded-[20px] bg-white px-4 py-1">
              {rows.map((row, index) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => open(row.key)}
                  className={`flex min-h-[74px] w-full items-center gap-2.5 py-4 text-left ${index < rows.length - 1 ? "border-b border-[#f2f4f6]" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] leading-4 font-medium text-[#8b95a1]">
                      {row.label}
                    </span>
                    <strong className="mt-1 block truncate text-[15px] leading-[22px] font-bold text-[#191f28]">
                      {row.value || "선택해 주세요"}
                    </strong>
                  </span>
                  <Image
                    src="/figma/catalog/chevron-right.svg"
                    alt=""
                    width={16}
                    height={16}
                  />
                </button>
              ))}
            </div>
          )}
          {error || loadError ? (
            <p
              role="alert"
              className="mt-3 rounded-2xl bg-white p-4 text-[13px] text-destructive"
            >
              {error || loadError}
            </p>
          ) : null}
        </div>
      </div>

      <dialog
        aria-labelledby="plan-sheet-title"
        ref={dialog}
        onCancel={() => setEditing(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setEditing(null);
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-[402px] overflow-y-auto rounded-t-[28px] bg-white p-5 text-[#191f28] backdrop:bg-black/40"
      >
        <div className="mb-5 flex min-h-10 items-center justify-between">
          <h2 id="plan-sheet-title" className="text-[20px] leading-7 font-bold">
            {editing === "purpose"
              ? "목표"
              : editing === "improvements"
                ? "집중할 부분"
                : editing === "schedule"
                  ? "연습 일정"
                  : "연습 방식"}
          </h2>
          <button
            type="button"
            onClick={() => setEditing(null)}
            aria-label="닫기"
            className="flex size-10 items-center justify-center"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-2">
          {options.map((option) => {
            const selected = selection.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  const multi =
                    editing === "improvements" || editing === "methods";
                  setSelection((current) =>
                    multi
                      ? current.includes(option.value)
                        ? current.filter((value) => value !== option.value)
                        : editing === "improvements" && current.length >= 3
                          ? current
                          : [...current, option.value]
                      : [option.value],
                  );
                }}
                className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-2 p-4 text-left ${selected ? "border-primary bg-[#edf2ff]" : "border-transparent bg-[#f7f8fa]"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-[22px] font-bold">
                    {option.title}
                  </span>
                  {option.description ? (
                    <span className="mt-1 block text-[12px] leading-4 text-[#6b7684]">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {selected ? <Check className="size-5 text-primary" /> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!selection.length || saving}
          onClick={() => void apply()}
          className="mt-6 h-14 w-full rounded-2xl bg-primary text-[15px] font-bold text-white disabled:bg-[#dfe3e7]"
        >
          {saving ? "저장 중…" : "변경하기"}
        </button>
      </dialog>
    </AppShell>
  );
}
