"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Check, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { useProfile, type OnboardingAnswers } from "@/lib/use-profile";
import {
  PURPOSE_OPTIONS,
  IMPROVEMENT_OPTIONS,
  METHOD_OPTIONS,
  SCHEDULE_OPTIONS,
  type EditSection,
} from "@/lib/onboarding-options";
export default function PracticePlan() {
  const router = useRouter();
  const { profile, hydrated, error: loadError, updatePlan } = useProfile();
  const [draft, setDraft] = useState<OnboardingAnswers | null>(null);
  const [editing, setEditing] = useState<EditSection | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (profile) setDraft(profile);
  }, [profile]);
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
          key: "schedule",
          label: "연습 일정",
          value: `주 ${draft.weeklySessions}일`,
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
  function apply() {
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
    if (editing === "improvements")
      value = {
        ...value,
        improvementAreas: selection,
        pronunciationConcerns: selection,
      };
    if (editing === "methods")
      value = { ...value, learningSituations: selection };
    if (editing === "schedule")
      value = {
        ...value,
        weeklySessions:
          SCHEDULE_OPTIONS.find((item) => item.value === selection[0])
            ?.weeklySessions ?? draft.weeklySessions,
      };
    setDraft(value);
    setEditing(null);
  }
  return (
    <AppShell nav={false} className="flex min-h-dvh flex-col !bg-white">
      <TopBar to="/mypage" title="연습 계획 수정" />
      <div className="flex-1 px-6 pt-8">
        <h1 className="mb-10 text-2xl leading-8 font-bold">
          연습 계획을
          <br />
          바꿔볼까요?
        </h1>
        {!hydrated && (
          <p className="text-sm text-muted-foreground">계획을 불러오는 중…</p>
        )}
        {rows.map((row) => (
          <button
            key={row.key}
            onClick={() => open(row.key)}
            className="flex min-h-16 w-full items-center gap-4 border-b border-[#f7f8fa] text-sm"
          >
            <span className="shrink-0 text-[#6b7684]">{row.label}</span>
            <span className="ml-auto text-right font-semibold">
              {row.value || "선택해 주세요"}
            </span>
            <ChevronRight className="size-4 shrink-0" />
          </button>
        ))}
        {(error || loadError) && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error || loadError}
          </p>
        )}
      </div>
      <div className="p-6 pb-10">
        <button
          disabled={!draft || saving}
          className="design-action"
          onClick={async () => {
            if (!draft) return;
            setSaving(true);
            setError(null);
            try {
              await updatePlan(draft);
              router.push("/mypage");
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "저장하지 못했습니다.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "저장 중…" : "저장하기"}
        </button>
      </div>
      <dialog
        aria-labelledby="plan-sheet-title"
        ref={dialog}
        onCancel={() => setEditing(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setEditing(null);
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-[402px] overflow-y-auto rounded-t-3xl bg-white p-6 text-[#191f28] backdrop:bg-black/40"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="plan-sheet-title" className="text-lg font-bold">
            {editing === "purpose"
              ? "무엇을 위해 연습하고 싶나요?"
              : editing === "improvements"
                ? "어떤 점을 개선하고 싶나요?"
                : editing === "schedule"
                  ? "일주일에 며칠 연습할까요?"
                  : "어떤 방식으로 연습할까요?"}
          </h2>
          <button
            onClick={() => setEditing(null)}
            aria-label="닫기"
            className="p-1"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-2">
          {options.map((option) => (
            <button
              key={option.value}
              aria-pressed={selection.includes(option.value)}
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
              className={`flex min-h-[72px] w-full items-center gap-3 rounded-2xl border-2 p-4 text-left ${selection.includes(option.value) ? "border-primary bg-[#f1f5ff]" : "border-transparent bg-[#f7f8fa]"}`}
            >
              <span className="flex-1">
                <span className="text-sm font-semibold">{option.title}</span>
                {option.description && (
                  <span className="mt-1 block text-xs text-[#6b7684]">
                    {option.description}
                  </span>
                )}
              </span>
              {selection.includes(option.value) && (
                <Check className="size-5 text-primary" />
              )}
            </button>
          ))}
        </div>
        <button
          disabled={!selection.length}
          className="design-action mt-6"
          onClick={apply}
        >
          변경 저장
        </button>
      </dialog>
    </AppShell>
  );
}
