"use client";

import { useCallback, useEffect, useState } from "react";
import type { Goal, Level, OnboardingProfile as UiProfile } from "./app-data";
import {
  api,
  type CurrentLevel,
  type OnboardingProfile as ApiProfile,
  type OnboardingSaveInput,
} from "./api";
import {
  decodeAudioAccessPreference,
  encodeAudioAccessPreference,
  withoutAudioAccessPreference,
  type AudioAccessPreference,
} from "./accessibility-preference";
import {
  getAuthenticatedUserId,
  getCachedUser,
  markAuthenticatedUser,
  markOnboardingCompleted,
} from "./auth-session";
import { readUserClientCache, writeUserClientCache } from "./client-cache";
import { updateMyPageOverviewCache } from "./my-page-cache";

export type OnboardingAnswers = UiProfile & {
  improvementAreas: string[];
  pronunciationConcerns: string[];
  learningSituations: string[];
  audioAccessPreference: AudioAccessPreference | null;
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

let cachedProfile: OnboardingAnswers | null = null;
let cachedProfileUserId: string | null = null;
const PROFILE_CACHE_RESOURCE = "onboarding-profile";

function currentUserId() {
  return getAuthenticatedUserId();
}

function fromApi(profile: ApiProfile, name: string): OnboardingAnswers {
  return {
    name,
    goals: profile.surveyAnswers.learningPurposes.map((value) =>
      value.toLowerCase(),
    ) as Goal[],
    level: levelFromApi[profile.currentLevel],
    minutesPerDay: profile.dailyGoalMinutes ?? 10,
    improvementAreas: profile.surveyAnswers.improvementAreas,
    pronunciationConcerns: profile.surveyAnswers.pronunciationConcerns,
    learningSituations: withoutAudioAccessPreference(
      profile.surveyAnswers.learningSituations,
    ),
    audioAccessPreference: decodeAudioAccessPreference(
      profile.surveyAnswers.learningSituations,
    ),
    weeklySessions: profile.weeklyGoalCount ?? 5,
    goalDescription: profile.goalText ?? "",
  };
}

function toApi(profile: OnboardingAnswers): OnboardingSaveInput {
  return {
    currentLevel: levelToApi[profile.level],
    goalText: profile.goalDescription,
    dailyGoalMinutes: profile.minutesPerDay,
    weeklyGoalCount: profile.weeklySessions,
    surveyAnswers: {
      learningPurposes: profile.goals.map((value) => value.toUpperCase()),
      improvementAreas: profile.improvementAreas,
      pronunciationConcerns: profile.pronunciationConcerns,
      learningSituations: profile.audioAccessPreference
        ? [
            ...profile.learningSituations,
            encodeAudioAccessPreference(profile.audioAccessPreference),
          ]
        : profile.learningSituations,
    },
  };
}

export function useProfile({ loadExisting = true } = {}) {
  const userId = currentUserId();
  const [initialProfile] = useState(() =>
    userId !== null && cachedProfileUserId === userId
      ? cachedProfile
      : readUserClientCache<OnboardingAnswers>(userId, PROFILE_CACHE_RESOURCE),
  );
  const [profile, setProfile] = useState<OnboardingAnswers | null>(
    initialProfile,
  );
  const [hydrated, setHydrated] = useState(
    () => !loadExisting || initialProfile !== null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadExisting) return;

    let active = true;
    const hasCachedProfile = initialProfile !== null;
    const cachedUser = getCachedUser();
    setError(null);
    Promise.all([
      api.onboarding.get(),
      cachedUser ? Promise.resolve(cachedUser) : api.users.getMe(),
    ])
      .then(([onboarding, user]) => {
        if (!active) return;
        const value = fromApi(onboarding, user.nickname);
        cachedProfile = value;
        cachedProfileUserId = String(user.id);
        writeUserClientCache(String(user.id), PROFILE_CACHE_RESOURCE, value);
        setProfile(value);
      })
      .catch((reason) => {
        if (active && !hasCachedProfile)
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
  }, [initialProfile, loadExisting, userId]);

  const save = useCallback(async (value: OnboardingAnswers) => {
    const nickname = value.name.trim();
    if (nickname) {
      await api.users.updateProfile({ nickname });
      const user = getCachedUser();
      if (user) markAuthenticatedUser({ ...user, nickname });
      updateMyPageOverviewCache({ nickname });
    }

    const completion = await api.onboarding.save(toApi(value));
    if (!completion.completed) {
      throw new Error("온보딩 완료 상태가 저장되지 않았습니다.");
    }
    const stored = await api.onboarding.get();
    if (!stored.completedAt) {
      throw new Error("저장된 온보딩 완료 상태를 확인하지 못했습니다.");
    }

    markOnboardingCompleted();
    cachedProfile = value;
    cachedProfileUserId = currentUserId();
    writeUserClientCache(cachedProfileUserId, PROFILE_CACHE_RESOURCE, value);
    setProfile(value);
    return value;
  }, []);

  const updateLearningGoals = useCallback(
    async (value: {
      goalDescription: string;
      minutesPerDay: number;
      weeklySessions: number;
    }) => {
      await api.onboarding.update({
        goalText: value.goalDescription,
        dailyGoalMinutes: value.minutesPerDay,
        weeklyGoalCount: value.weeklySessions,
      });

      setProfile((current) => {
        if (!current) return current;
        const updated = { ...current, ...value };
        cachedProfile = updated;
        cachedProfileUserId = currentUserId();
        writeUserClientCache(
          cachedProfileUserId,
          PROFILE_CACHE_RESOURCE,
          updated,
        );
        return updated;
      });
    },
    [],
  );

  const updatePlan = useCallback(async (value: OnboardingAnswers) => {
    const input = toApi(value);
    await api.onboarding.update({
      goalText: input.goalText,
      dailyGoalMinutes: input.dailyGoalMinutes,
      weeklyGoalCount: input.weeklyGoalCount,
      surveyAnswers: input.surveyAnswers,
    });
    cachedProfile = value;
    cachedProfileUserId = currentUserId();
    writeUserClientCache(cachedProfileUserId, PROFILE_CACHE_RESOURCE, value);
    setProfile(value);
  }, []);

  return { profile, hydrated, error, save, updateLearningGoals, updatePlan };
}
