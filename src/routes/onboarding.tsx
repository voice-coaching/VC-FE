"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  GOAL_LABELS,
  LEVEL_LABELS,
  type Goal,
  type Level,
} from "@/lib/app-data";
import { useProfile } from "@/lib/use-profile";

const IMPROVEMENT_AREAS = ["발음", "억양", "말하기 속도", "강세와 리듬"];
const PRONUNCIATION_CONCERNS = [
  "받침",
  "된소리",
  "자음",
  "모음",
  "특정 고민 없음",
];
const LEARNING_SITUATIONS = ["발표", "대화", "면접", "방송", "회의"];

export default function Onboarding() {
  const router = useRouter();
  const { save } = useProfile({ loadExisting: false });
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [improvementAreas, setImprovementAreas] = useState<string[]>([]);
  const [pronunciationConcerns, setPronunciationConcerns] = useState<string[]>(
    [],
  );
  const [learningSituations, setLearningSituations] = useState<string[]>([]);
  const [level, setLevel] = useState<Level | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [weeklySessions, setWeeklySessions] = useState<number | null>(null);
  const [goalDescription, setGoalDescription] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.users
      .getMe()
      .then((user) => {
        if (active) setName(user.nickname);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const toggleRequired = (
    setter: Dispatch<SetStateAction<string[]>>,
    value: string,
  ) =>
    setter((items) =>
      items.includes(value)
        ? items.length > 1
          ? items.filter((item) => item !== value)
          : items
        : [...items, value],
    );

  const steps = [
    {
      q: "또박에서\n무엇을 이루고 싶나요?",
      hint: "복수 선택 가능 · 최소 1개",
      body: (
        <Options
          items={Object.entries(GOAL_LABELS)}
          selected={goals}
          onSelect={(value) => {
            const goal = value as Goal;
            setGoals((items) =>
              items.includes(goal)
                ? items.length > 1
                  ? items.filter((item) => item !== goal)
                  : items
                : [...items, goal],
            );
          }}
        />
      ),
      valid: goals.length > 0,
    },
    {
      q: "집중해서 개선하고 싶은\n영역을 골라주세요",
      hint: "복수 선택 가능 · 최소 1개",
      body: (
        <Options
          items={IMPROVEMENT_AREAS.map(
            (item) => [item, item] as [string, string],
          )}
          selected={improvementAreas}
          onSelect={(value) => toggleRequired(setImprovementAreas, value)}
        />
      ),
      valid: improvementAreas.length > 0,
    },
    {
      q: "어떤 발음이\n가장 어렵게 느껴지나요?",
      hint: "복수 선택 가능 · 최소 1개",
      body: (
        <Options
          items={PRONUNCIATION_CONCERNS.map(
            (item) => [item, item] as [string, string],
          )}
          selected={pronunciationConcerns}
          onSelect={(value) => toggleRequired(setPronunciationConcerns, value)}
        />
      ),
      valid: pronunciationConcerns.length > 0,
    },
    {
      q: "주로 어떤 상황에서\n말하기를 활용하나요?",
      hint: "복수 선택 가능 · 최소 1개",
      body: (
        <Options
          items={LEARNING_SITUATIONS.map(
            (item) => [item, item] as [string, string],
          )}
          selected={learningSituations}
          onSelect={(value) => toggleRequired(setLearningSituations, value)}
        />
      ),
      valid: learningSituations.length > 0,
    },
    {
      q: "지금 내 말하기\n수준은 어느 정도인가요?",
      hint: "하나만 선택",
      body: (
        <Options
          items={Object.entries(LEVEL_LABELS)}
          selected={level ? [level] : []}
          onSelect={(v) => setLevel(v as Level)}
        />
      ),
      valid: !!level,
    },
    {
      q: "또박과 함께 이루고 싶은\n구체적인 목표가 있나요?",
      hint: "선택한 목표를 내 말로 적어보세요",
      body: (
        <textarea
          value={goalDescription}
          onChange={(e) => setGoalDescription(e.target.value)}
          rows={5}
          placeholder="예: 다음 발표에서 천천히 또렷하게 말하고 싶어요."
          className="w-full resize-none rounded-3xl bg-surface p-5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      ),
      valid: goalDescription.trim().length >= 4,
    },
    {
      q: "하루에 몇 분\n연습할까요?",
      hint: "알림으로 매일 챙겨드릴게요",
      body: (
        <div className="flex flex-col gap-6">
          <p className="text-xs font-medium text-muted-foreground">
            하루 학습 시간
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 30].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
                className={cn(
                  "rounded-2xl py-4 text-sm font-semibold transition-colors",
                  minutes === m
                    ? "bg-foreground text-background"
                    : "bg-surface",
                )}
              >
                {m}분
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            주간 학습 횟수
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[3, 5, 7].map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={weeklySessions === count}
                onClick={() => setWeeklySessions(count)}
                className={cn(
                  "rounded-2xl py-4 text-sm font-semibold transition-colors",
                  weeklySessions === count
                    ? "bg-foreground text-background"
                    : "bg-surface",
                )}
              >
                주 {count}회
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              이름
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력해 주세요"
              className="rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      ),
      valid:
        minutes !== null && weeklySessions !== null && name.trim().length > 0,
    },
  ];

  const cur = steps[step];

  return (
    <AppShell nav={false}>
      <TopBar
        to={step === 0 ? "/auth" : "/onboarding"}
        onBack={step > 0 ? () => setStep((value) => value - 1) : undefined}
        progress={((step + 1) / steps.length) * 100}
      />
      <div className="flex min-h-[calc(100dvh-84px)] flex-col px-6 pb-10">
        <h1 className="mt-6 text-2xl leading-snug font-bold whitespace-pre-line">
          {cur.q}
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">{cur.hint}</p>
        <div className="mt-8 flex-1">{cur.body}</div>
        <button
          disabled={!cur.valid || saving}
          onClick={async () => {
            if (step < steps.length - 1) return setStep(step + 1);
            if (
              !level ||
              minutes === null ||
              weeklySessions === null ||
              !name.trim()
            )
              return;
            setSaving(true);
            setError(null);
            try {
              await save({
                name: name.trim(),
                goals,
                improvementAreas,
                pronunciationConcerns,
                learningSituations,
                level,
                minutesPerDay: minutes,
                weeklySessions,
                goalDescription: goalDescription.trim(),
              });
              router.replace("/home");
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "설문을 저장하지 못했습니다.",
              );
            } finally {
              setSaving(false);
            }
          }}
          className="w-full rounded-full bg-foreground py-4 text-sm font-semibold text-background disabled:opacity-30"
        >
          {saving
            ? "저장 중…"
            : step < steps.length - 1
              ? "계속"
              : "내 학습 시작하기"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Options({
  items,
  selected,
  onSelect,
}: {
  items: [string, string][];
  selected: string[];
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={selected.includes(value)}
          onClick={() => onSelect(value)}
          className={cn(
            "rounded-2xl px-5 py-4 text-left text-sm font-medium transition-colors",
            selected.includes(value)
              ? "bg-foreground text-background"
              : "bg-surface text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
