export type Goal =
  "presentation" | "interview" | "broadcast" | "daily" | "meeting";

export type Level = "beginner" | "intermediate" | "advanced";

export interface OnboardingProfile {
  name: string;
  goals: Goal[];
  level: Level;
  minutesPerDay: number;
  weeklySessions: number;
}

export const GOAL_LABELS: Record<Goal, string> = {
  presentation: "발표·프레젠테이션",
  interview: "면접 준비",
  broadcast: "아나운싱·방송",
  daily: "일상 대화 또렷하게",
  meeting: "회의·업무 커뮤니케이션",
};

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "이제 막 시작했어요",
  intermediate: "기본은 되지만 아쉬워요",
  advanced: "디테일을 다듬고 싶어요",
};

export function scoreColor(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-destructive";
}
