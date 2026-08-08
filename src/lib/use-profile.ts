"use client";

import { useCallback, useEffect, useState } from "react";
import type { Goal, Level, OnboardingProfile as UiProfile } from "./app-data";
import {
  api,
  type CurrentLevel,
  type OnboardingProfile as ApiProfile,
} from "./api";

const KEY = "voco.profile";

export type OnboardingAnswers = UiProfile & {
  improvementAreas: string[];
  pronunciationConcerns: string[];
  learningSituations: string[];
  weeklySessions?: number;
  goalDescription?: string;
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
    weakness: profile.surveyAnswers.improvementAreas[0] ?? "",
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
    goalText: profile.goalDescription ?? profile.weakness,
    dailyGoalMinutes: profile.minutesPerDay,
    weeklyGoalCount: profile.weeklySessions ?? 5,
    surveyAnswers: {
      learningPurposes: profile.goals.map((value) => value.toUpperCase()),
      improvementAreas: profile.improvementAreas,
      pronunciationConcerns: profile.pronunciationConcerns,
      learningSituations: profile.learningSituations,
    },
  };
}

export function readProfile(): OnboardingAnswers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingAnswers) : null;
  } catch {
    return null;
  }
}

export function writeProfile(profile: OnboardingAnswers) {
  window.localStorage.setItem(KEY, JSON.stringify(profile));
}

export function useProfile() {
  const [profile, setProfile] = useState<OnboardingAnswers | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.onboarding.get(), api.users.getMe()])
      .then(([onboarding, user]) => {
        if (!active) return;
        const value = fromApi(onboarding, user.nickname);
        setProfile(value);
        writeProfile(value);
      })
      .catch(() => {
        if (active) setProfile(readProfile());
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (value: OnboardingAnswers) => {
    await api.onboarding.save(toApi(value));
    if (value.name.trim())
      await api.users.updateProfile({ nickname: value.name.trim() });
    writeProfile(value);
    setProfile(value);
    return value;
  }, []);

  return { profile, hydrated, save };
}
