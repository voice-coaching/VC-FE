import type { CourseProgress, CourseStep, Id } from "@/lib/api";

export function courseResultProgress(
  steps: CourseStep[],
  current: CourseProgress,
  practiceStepId: Id,
) {
  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  let index = ordered.findIndex(
    (step) => String(step.id) === String(practiceStepId),
  );
  if (index < 0) throw new Error("클래스의 연습 단계를 찾을 수 없습니다.");
  // Displaying the result also fulfills the consecutive result-review steps.
  while (ordered[index + 1]?.stepType === "RESULT_REVIEW") index += 1;
  const completedPercent = Math.round(((index + 1) / ordered.length) * 100);
  return {
    lastStepId:
      current.progressPercent > completedPercent
        ? (current.lastStepId ?? ordered[index].id)
        : ordered[index].id,
    progressPercent: Math.max(current.progressPercent, completedPercent),
  };
}
