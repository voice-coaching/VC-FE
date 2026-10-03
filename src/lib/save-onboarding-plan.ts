import type { ApiContract, OnboardingSaveInput } from "./api/types";

export async function saveOnboardingPlan(
  api: Pick<ApiContract, "onboarding">,
  input: OnboardingSaveInput,
) {
  // PATCH treats null as unchanged. PUT replaces all answers and can clear a goal.
  if (input.weeklyGoalCount === null) {
    const result = await api.onboarding.save(input);
    if (!result.completed) throw new Error("연습 계획이 저장되지 않았습니다.");
  } else {
    await api.onboarding.update({
      goalText: input.goalText,
      dailyGoalMinutes: input.dailyGoalMinutes,
      weeklyGoalCount: input.weeklyGoalCount,
      surveyAnswers: input.surveyAnswers,
    });
  }
  const stored = await api.onboarding.get();
  if (stored.weeklyGoalCount !== input.weeklyGoalCount)
    throw new Error("주간 목표가 저장되지 않았습니다. 다시 시도해 주세요.");
  return stored;
}
