import {
  PURPOSE_OPTIONS,
  IMPROVEMENT_OPTIONS,
  SCHEDULE_OPTIONS,
  METHOD_OPTIONS,
} from "./onboarding-options";

export type PracticePlan = {
  goal: string;
  focus: string;
  schedule: string;
  method: string;
};

export const planKey = "speakai:prototype-plan:v1";
export const initialPlan: PracticePlan = {
  goal: "일상에서 자연스럽게 말하기",
  focus: "빠른 말하기, 말 습관",
  schedule: "주 2~3일",
  method: "짧은 문장 반복, 내 원고",
};

export const planFields = [
  ["goal", "목표"],
  ["focus", "집중할 부분"],
  ["schedule", "연습 일정"],
  ["method", "연습 방식"],
] as const;

type PlanOption = {
  value: string;
  title: string;
  description?: string;
  icon?: string;
  iconClassName?: string;
};

export const planOptions: Record<keyof PracticePlan, PlanOption[]> = {
  goal: PURPOSE_OPTIONS.map((option) => ({ ...option, value: option.title })),
  focus: IMPROVEMENT_OPTIONS.map((option) => ({
    value: option.summary,
    title: option.value,
  })),
  schedule: SCHEDULE_OPTIONS.map((option) => ({
    ...option,
    value: option.title,
  })),
  method: METHOD_OPTIONS.map((option) => ({
    ...option,
    value: option.summary,
  })),
};

/** Preserve previously saved plans, which did not have a focus field. */
export function parsePracticePlan(raw: string | null): PracticePlan {
  try {
    const value = JSON.parse(raw ?? "null");
    return Object.fromEntries(
      planFields.map(([key]) => [
        key,
        typeof value?.[key] === "string" && value[key].trim()
          ? value[key].trim()
          : initialPlan[key],
      ]),
    ) as PracticePlan;
  } catch {
    return { ...initialPlan };
  }
}

export function selectedPlanOptions(field: keyof PracticePlan, value: string) {
  return field === "focus" || field === "method"
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [value];
}
