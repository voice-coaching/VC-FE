import type {
  UserTitleCode,
  UserTitleLabel,
  UserTitleProgress,
} from "./api/types";

export const USER_TITLE_LEVELS = [
  {
    code: "ABSOLUTE_BEGINNER",
    label: "왕초보",
    requiredTrainingCount: 0,
    passingScore: 0,
  },
  {
    code: "BEGINNER",
    label: "초보",
    requiredTrainingCount: 5,
    passingScore: 70,
  },
  {
    code: "LOCAL_ANNOUNCER",
    label: "동네 아나운서",
    requiredTrainingCount: 15,
    passingScore: 75,
  },
  {
    code: "ASPIRING_ANNOUNCER",
    label: "아나운서 지망생",
    requiredTrainingCount: 30,
    passingScore: 80,
  },
  {
    code: "ANNOUNCER",
    label: "아나운서",
    requiredTrainingCount: 60,
    passingScore: 85,
  },
] as const satisfies ReadonlyArray<{
  code: UserTitleCode;
  label: UserTitleLabel;
  requiredTrainingCount: number;
  passingScore: number;
}>;

export function getUserTitleProgress(
  currentTitleCode: UserTitleCode,
  completedTrainingCount: number,
  updatedAt = new Date().toISOString(),
): UserTitleProgress {
  const count = Math.max(0, Math.floor(completedTrainingCount));
  const current =
    USER_TITLE_LEVELS.find((level) => level.code === currentTitleCode) ??
    USER_TITLE_LEVELS[0];
  const currentIndex = USER_TITLE_LEVELS.indexOf(current);
  const next = USER_TITLE_LEVELS[currentIndex + 1] ?? null;

  return {
    code: current.code,
    label: current.label,
    minimumTrainingCount: current.requiredTrainingCount,
    completedTrainingCount: count,
    next: next
      ? {
          code: next.code,
          label: next.label,
          requiredTrainingCount: next.requiredTrainingCount,
          remainingTrainingCount: Math.max(
            0,
            next.requiredTrainingCount - count,
          ),
          passingScore: next.passingScore,
          eligible: count >= next.requiredTrainingCount,
        }
      : null,
    updatedAt,
  };
}
