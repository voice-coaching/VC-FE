"use client";

import { useCallback, useEffect, useState } from "react";
import type { Goal, Level, OnboardingProfile as UiProfile } from "./app-data";
import {
  api,
  type CurrentLevel,
  type OnboardingProfile as ApiProfile,
} from "./api";

export type OnboardingAnswers = UiProfile & {
  improvementAreas: string[];
  pronunciationConcerns: string[];
  learningSituations: string[];
  goalDescription: string;
};

const levelFromApi: Record<CurrentLevel, Level> = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
};

const levelToApi: Record<Level, CurrentLevel> = {
  beginner: "BEGINNER",
  intermediate: "INTERMEDIATE",
  advanced: "ADVANCED",
};

function fromApi(profile: ApiProfile, name: string): OnboardingAnswers {
  return {
    name,
    goals: profile.surveyAnswers.learningPurposes.map((value) =>
      value.toLowerCase(),
    ) as Goal[],
    level: levelFromApi[profile.currentLevel],
    minutesPerDay: profile.dailyGoalMinutes,
    improvementAreas: profile.surveyAnswers.improvementAreas,
    pronunciationConcerns: profile.surveyAnswers.pronunciationConcerns,
    learningSituations: profile.surveyAnswers.learningSituations,
    weeklySessions: profile.weeklyGoalCount,
    goalDescription: profile.goalText,
  };
}

function toApi(profile: OnboardingAnswers): ApiProfile {
  return {
    currentLevel: levelToApi[profile.level],
    goalText: profile.goalDescription,
    dailyGoalMinutes: profile.minutesPerDay,
    weeklyGoalCount: profile.weeklySessions,
    surveyAnswers: {
      learningPurposes: profile.goals.map((value) => value.toUpperCase()),
      improvementAreas: profile.improvementAreas,
      pronunciationConcerns: profile.pronunciationConcerns,
      learningSituations: profile.learningSituations,
    },
  };
}

export function useProfile({ loadExisting = true } = {}) {
  const [profile, setProfile] = useState<OnboardingAnswers | null>(null);
  const [hydrated, setHydrated] = useState(() => !loadExisting);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadExisting) {
      return;
    }

    let active = true;
    Promise.all([api.onboarding.get(), api.users.getMe()])
      .then(([onboarding, user]) => {
        if (!active) return;
        const value = fromApi(onboarding, user.nickname);
        setProfile(value);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "프로필을 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [loadExisting]);

  const save = useCallback(async (value: OnboardingAnswers) => {
    if (value.name.trim())
      await api.users.updateProfile({ nickname: value.name.trim() });

    const completion = await api.onboarding.save(toApi(value));
    if (!completion.completed) {
      throw new Error("온보딩 완료 상태가 저장되지 않았습니다.");
    }

    setProfile(value);
    return value;
  }, []);

  return { profile, hydrated, error, save };
}
