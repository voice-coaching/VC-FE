import { getAccessToken, saveAccessToken } from "./api/client";
import type { AuthSession, HomeDashboard, LoginInput } from "./api/types";
import type { OnboardingAnswers } from "./use-profile";

export const DEV_ACCOUNT = Object.freeze({
  email: "dev@ttobak.local",
  password: "Dev1234!",
  nickname: "개발자",
});

const DEV_ACCESS_TOKEN = "ttobak-local-development-token";

export function isDevAccountEnabled(nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv !== "development") return false;
  return (
    process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNT === "true" ||
    !process.env.NEXT_PUBLIC_API_BASE_URL
  );
}

export function createDevSession(
  input: LoginInput,
  nodeEnv = process.env.NODE_ENV,
): AuthSession | null {
  if (
    !isDevAccountEnabled(nodeEnv) ||
    input.email !== DEV_ACCOUNT.email ||
    input.password !== DEV_ACCOUNT.password
  ) {
    return null;
  }

  saveAccessToken(DEV_ACCESS_TOKEN);
  return {
    accessToken: DEV_ACCESS_TOKEN,
    tokenType: "Bearer",
    expiresIn: 86_400,
    onboardingRequired: false,
    user: {
      id: "local-dev-user",
      email: DEV_ACCOUNT.email,
      nickname: DEV_ACCOUNT.nickname,
      onboardingCompleted: true,
    },
  };
}

export function isDevSession() {
  return isDevAccountEnabled() && getAccessToken() === DEV_ACCESS_TOKEN;
}

export const DEV_PROFILE: OnboardingAnswers = {
  name: DEV_ACCOUNT.nickname,
  goals: ["presentation"],
  level: "beginner",
  minutesPerDay: 10,
  weakness: "발음과 억양",
  improvementAreas: ["PRONUNCIATION", "INTONATION"],
  pronunciationConcerns: [],
  learningSituations: ["PRESENTATION"],
  weeklySessions: 5,
  goalDescription: "개발 환경에서 화면과 API 연동 상태 확인",
};

export const DEV_DASHBOARD: HomeDashboard = {
  today: { completedCount: 0, goalCount: 1, learningSeconds: 0 },
  recommendations: [],
  recentTraining: null,
  courseProgress: null,
};
