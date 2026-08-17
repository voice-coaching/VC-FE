import { clearAccessToken, createHttpClient, saveAccessToken } from "./client";
import type {
  ApiContract,
  AuthSession,
  ContentType,
  CourseStep,
  Id,
  PageResult,
  PracticeContent,
  PracticeContentSummary,
  Recommendation,
  ReferenceAudio,
  TrainingHistoryItem,
  UserCourseProgress,
  VoiceRecording,
} from "./types";

type QueryValue = string | number | boolean | undefined | null;

function query(params: Record<string, QueryValue>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

const id = (value: Id) => encodeURIComponent(String(value));

export function createRemoteApi(baseUrl: string): ApiContract {
  const { request, upload } = createHttpClient(baseUrl);

  function persistSession(session: AuthSession) {
    saveAccessToken(session.accessToken);
    return session;
  }

  return {
    auth: {
      checkEmail: (email) =>
        request(`/api/auth/email-availability${query({ email })}`, {
          skipAuth: true,
        }),
      async signUp(input) {
        const data = await request<{
          userId: Id;
          email: string;
          nickname: string;
          accessToken: string;
          tokenType: string;
          expiresIn: number;
          onboardingRequired: boolean;
        }>("/api/auth/signup", { method: "POST", body: input, skipAuth: true });
        return persistSession({
          accessToken: data.accessToken,
          tokenType: data.tokenType,
          expiresIn: data.expiresIn,
          onboardingRequired: data.onboardingRequired,
          user: { id: data.userId, email: data.email, nickname: data.nickname },
        });
      },
      async signIn(input) {
        const data = await request<{
          accessToken: string;
          tokenType: string;
          expiresIn: number;
          user: { id: Id; nickname: string; onboardingCompleted: boolean };
        }>("/api/auth/login", { method: "POST", body: input, skipAuth: true });
        return persistSession({
          ...data,
          onboardingRequired: !data.user.onboardingCompleted,
        });
      },
      async socialLogin(input) {
        const data = await request<{
          accessToken: string;
          tokenType: string;
          expiresIn: number;
          isNewUser: boolean;
          onboardingRequired: boolean;
          user: { id: Id; email: string; nickname: string };
        }>("/api/auth/social-login", {
          method: "POST",
          body: input,
          skipAuth: true,
        });
        return persistSession(data);
      },
      async refresh() {
        const data = await request<{
          accessToken: string;
          tokenType: string;
          expiresIn: number;
        }>("/api/auth/token/refresh", {
          method: "POST",
          skipAuth: true,
          skipRefresh: true,
        });
        saveAccessToken(data.accessToken);
        return data;
      },
      async signOut() {
        try {
          await request<null>("/api/auth/logout", { method: "POST" });
        } finally {
          clearAccessToken();
        }
      },
    },
    users: {
      getMe: () => request("/api/users/me"),
      updateProfile: (input) =>
        request("/api/users/me", { method: "PATCH", body: input }),
      async withdraw() {
        const result = await request<{ withdrawnAt: string }>("/api/users/me", {
          method: "DELETE",
        });
        clearAccessToken();
        return result;
      },
    },
    onboarding: {
      get: () => request("/api/onboarding/me"),
      save: (input) =>
        request("/api/onboarding/me", { method: "PUT", body: input }),
      update: (input) =>
        request("/api/onboarding/me", { method: "PATCH", body: input }),
    },
    home: {
      get: () => request("/api/home"),
      async getRecommendations(filters = {}) {
        const data = await request<{ items: Recommendation[] }>(
          `/api/recommendations${query(filters)}`,
        );
        return data.items;
      },
      getRecentTraining: () =>
        request("/api/users/me/training-sessions/recent"),
    },
    content: {
      list: (filters = {}) =>
        request<PageResult<PracticeContentSummary>>(
          `/api/practice-contents${query(filters)}`,
        ),
      get: (contentId) =>
        request<PracticeContent>(`/api/practice-contents/${id(contentId)}`),
      getNext: (filters) =>
        request<PracticeContent>(
          `/api/practice-contents/next${query(filters)}`,
        ),
      async getRecommendations(contentId, limit) {
        const data = await request<{
          items: Array<{
            id: Id;
            title: string;
            contentType: ContentType;
            similarityReason: string;
          }>;
        }>(
          `/api/practice-contents/${id(contentId)}/recommendations${query({ limit })}`,
        );
        return data.items;
      },
      async getReferenceAudios(contentId) {
        const data = await request<{ items: ReferenceAudio[] }>(
          `/api/practice-contents/${id(contentId)}/reference-audios`,
        );
        return data.items;
      },
      getReferenceAudioPlaybackUrl: (audioId) =>
        request(`/api/reference-audios/${id(audioId)}/playback-url`),
    },
    courses: {
      list: (filters = {}) => request(`/api/courses${query(filters)}`),
      get: (courseId) => request(`/api/courses/${id(courseId)}`),
      start: (courseId) =>
        request(`/api/courses/${id(courseId)}/start`, { method: "POST" }),
      getProgress: (courseId) =>
        request(`/api/courses/${id(courseId)}/progress`),
      updateProgress: (courseId, input) =>
        request(`/api/courses/${id(courseId)}/progress`, {
          method: "PATCH",
          body: input,
        }),
      complete: (courseId) =>
        request(`/api/courses/${id(courseId)}/complete`, { method: "POST" }),
      async getSteps(courseId) {
        const data = await request<{ items: CourseStep[] }>(
          `/api/courses/${id(courseId)}/steps`,
        );
        return data.items;
      },
      async getMyProgress(status) {
        const data = await request<{ items: UserCourseProgress[] }>(
          `/api/users/me/course-progress${query({ status })}`,
        );
        return data.items;
      },
    },
    training: {
      create: (input) =>
        request("/api/training-sessions", { method: "POST", body: input }),
      get: (sessionId) => request(`/api/training-sessions/${id(sessionId)}`),
      cancel: (sessionId) =>
        request(`/api/training-sessions/${id(sessionId)}/cancel`, {
          method: "POST",
        }),
      getUploadUrl: (sessionId, input) =>
        request(
          `/api/training-sessions/${id(sessionId)}/recordings/upload-url`,
          {
            method: "POST",
            body: input,
          },
        ),
      uploadRecording: (uploadInfo, audio, onProgress) =>
        upload(
          uploadInfo.uploadUrl,
          audio,
          uploadInfo.requiredHeaders,
          onProgress,
        ),
      registerRecording: (sessionId, input) =>
        request(`/api/training-sessions/${id(sessionId)}/recordings`, {
          method: "POST",
          body: input,
        }),
      async listRecordings(sessionId) {
        const data = await request<{ items: VoiceRecording[] }>(
          `/api/training-sessions/${id(sessionId)}/recordings`,
        );
        return data.items;
      },
      deleteRecording: (sessionId, recordingId) =>
        request(
          `/api/training-sessions/${id(sessionId)}/recordings/${id(recordingId)}`,
          {
            method: "DELETE",
          },
        ),
      selectRecording: (sessionId, recordingId) =>
        request(
          `/api/training-sessions/${id(sessionId)}/recordings/${id(recordingId)}/select`,
          { method: "PATCH" },
        ),
      analyze: (sessionId) =>
        request(`/api/training-sessions/${id(sessionId)}/analyze`, {
          method: "POST",
        }),
      getAnalysisStatus: (sessionId) =>
        request(`/api/training-sessions/${id(sessionId)}/analysis/status`),
      retryAnalysis: (sessionId) =>
        request(`/api/training-sessions/${id(sessionId)}/analysis/retry`, {
          method: "POST",
        }),
      getSessionAnalysis: (sessionId) =>
        request(`/api/training-sessions/${id(sessionId)}/analysis`),
      getRecordingPlaybackUrl: (recordingId) =>
        request(`/api/recordings/${id(recordingId)}/playback-url`),
      complete: (sessionId, totalLearningSeconds) =>
        request(`/api/training-sessions/${id(sessionId)}/complete`, {
          method: "POST",
          body: { totalLearningSeconds },
        }),
    },
    analyses: {
      get: (analysisId) => request(`/api/analyses/${id(analysisId)}`),
      getSegments: (analysisId, filters = {}) =>
        request(`/api/analyses/${id(analysisId)}/segments${query(filters)}`),
      regenerateFeedback: (analysisId, feedbackStyle) =>
        request(`/api/analyses/${id(analysisId)}/feedback/regenerate`, {
          method: "POST",
          body: { feedbackStyle },
        }),
    },
    myPage: {
      getStatistics: (filters = {}) =>
        request(`/api/users/me/statistics${query(filters)}`),
      getScoreTrends: (metric, period) =>
        request(`/api/users/me/score-trends${query({ metric, period })}`),
      getStrengthsWeaknesses: (filters = {}) =>
        request(`/api/users/me/strengths-weaknesses${query(filters)}`),
      listTrainingSessions: (filters = {}) =>
        request<PageResult<TrainingHistoryItem>>(
          `/api/users/me/training-sessions${query(filters)}`,
        ),
      getTrainingSession: (sessionId) =>
        request(`/api/users/me/training-sessions/${id(sessionId)}`),
      deleteTrainingSession: (sessionId) =>
        request(`/api/users/me/training-sessions/${id(sessionId)}`, {
          method: "DELETE",
        }),
      getWeaknessRecommendations: (filters = {}) =>
        request(`/api/users/me/weakness-recommendations${query(filters)}`),
    },
  };
}
