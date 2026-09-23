import {
  ApiError,
  clearAccessToken,
  createHttpClient,
  getAuthSessionVersion,
  saveAccessToken,
} from "./client";
import {
  markAnonymousSession,
  markAuthenticatedSession,
  markAuthenticatedUser,
} from "../auth-session";
import type {
  ApiContract,
  AuthSession,
  ContentType,
  CourseStep,
  Id,
  NextPracticeContent,
  OnboardingProfile,
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

function profileImageForm(input: { file: Blob; fileName: string }) {
  const form = new FormData();
  form.set("file", input.file, input.fileName);
  return form;
}

function idempotencyHeaders(idempotencyKey?: string) {
  return idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
}

export function createRemoteApi(baseUrl: string): ApiContract {
  const { request, requestAudio, upload, refreshAccessToken } =
    createHttpClient(baseUrl);

  async function persistSession(
    session: AuthSession,
    { reconcileOnboarding = false } = {},
  ) {
    let normalizedSession = {
      ...session,
      accessToken: saveAccessToken(session.accessToken),
    };
    markAuthenticatedSession(normalizedSession);

    if (
      !reconcileOnboarding ||
      normalizedSession.isNewUser ||
      !normalizedSession.onboardingRequired
    ) {
      return normalizedSession;
    }

    try {
      const onboarding = await request<OnboardingProfile>("/api/onboarding/me");
      if (onboarding.completedAt) {
        normalizedSession = {
          ...normalizedSession,
          onboardingRequired: false,
          user: {
            ...normalizedSession.user,
            onboardingCompleted: true,
          },
        };
        markAuthenticatedSession(normalizedSession);
      }
    } catch (reason) {
      if (!(reason instanceof ApiError && reason.status === 404)) throw reason;
    }

    return normalizedSession;
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
        return persistSession(
          {
            ...data,
            onboardingRequired: !data.user.onboardingCompleted,
          },
          { reconcileOnboarding: true },
        );
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
        return persistSession(data, { reconcileOnboarding: true });
      },
      refresh: refreshAccessToken,
      async signOut() {
        const version = getAuthSessionVersion();
        try {
          await request<null>("/api/auth/logout", { method: "POST" });
        } finally {
          if (version === getAuthSessionVersion()) {
            clearAccessToken();
            markAnonymousSession();
          }
        }
      },
    },
    users: {
      async getMe() {
        const user =
          await request<Awaited<ReturnType<ApiContract["users"]["getMe"]>>>(
            "/api/users/me",
          );
        markAuthenticatedUser(user);
        return user;
      },
      updateProfile: (input) =>
        request("/api/users/me", { method: "PATCH", body: input }),
      getProfileImage: () => request("/api/users/me/profile-image"),
      createProfileImage: (input, idempotencyKey) =>
        request("/api/users/me/profile-image", {
          method: "POST",
          body: profileImageForm(input),
          headers: idempotencyHeaders(idempotencyKey),
        }),
      updateProfileImage: (input) =>
        request("/api/users/me/profile-image", {
          method: "PUT",
          body: profileImageForm(input),
        }),
      deleteProfileImage: () =>
        request("/api/users/me/profile-image", { method: "DELETE" }),
      getTitle: () => request("/api/users/me/title"),
      createTitleExam: (idempotencyKey) =>
        request("/api/users/me/title-exams", {
          method: "POST",
          headers: idempotencyHeaders(idempotencyKey),
        }),
      getTitleExam: (examId) =>
        request(`/api/users/me/title-exams/${id(examId)}`),
      submitTitleExam: (examId, analysisId) =>
        request(`/api/users/me/title-exams/${id(examId)}/submit`, {
          method: "POST",
          body: { analysisId },
        }),
      async withdraw() {
        const result = await request<{ withdrawnAt: string }>("/api/users/me", {
          method: "DELETE",
        });
        clearAccessToken();
        markAnonymousSession();
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
      createCustom: (input, idempotencyKey) =>
        request("/api/practice-contents/custom", {
          method: "POST",
          body: input,
          headers: idempotencyHeaders(idempotencyKey),
        }),
      getFacets: (type) =>
        request(`/api/practice-contents/facets${query({ type })}`),
      getAdjacent: (contentId, filters) =>
        request(
          `/api/practice-contents/${id(contentId)}/adjacent${query(filters)}`,
        ),
      get: (contentId) =>
        request<PracticeContent>(`/api/practice-contents/${id(contentId)}`),
      getNext: (filters) =>
        request<NextPracticeContent>(
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
    examples: {
      list: (courseId, stepId, sessionId) =>
        request(
          `/api/courses/${id(courseId)}/steps/${id(stepId)}/practice-examples${query({ sessionId })}`,
        ),
      getAudio: (exampleId, signal) =>
        requestAudio(`/api/practice-examples/${id(exampleId)}/audio`, {
          signal,
        }),
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
      getStep: (courseId, stepId, sessionId) =>
        request(
          `/api/courses/${id(courseId)}/steps/${id(stepId)}${query({ sessionId })}`,
        ),
      async getMyProgress(status) {
        const data = await request<{ items: UserCourseProgress[] }>(
          `/api/users/me/course-progress${query({ status })}`,
        );
        return data.items;
      },
    },
    training: {
      getAnalysisCapabilities: () => request("/api/analysis-capabilities"),
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
      analyze: (sessionId, consent) =>
        request(`/api/training-sessions/${id(sessionId)}/analyze`, {
          method: "POST",
          body: consent,
        }),
      getAnalysisStatus: (sessionId) =>
        request(`/api/training-sessions/${id(sessionId)}/analysis/status`),
      retryAnalysis: (sessionId, consent) =>
        request(`/api/training-sessions/${id(sessionId)}/analysis/retry`, {
          method: "POST",
          body: consent,
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
    notifications: {
      getPreferences: () => request("/api/users/me/notification-preferences"),
      updatePreferences: (input) =>
        request("/api/users/me/notification-preferences", {
          method: "PATCH",
          body: input,
        }),
      createPushSubscription: (input, idempotencyKey) =>
        request("/api/users/me/push-subscriptions", {
          method: "POST",
          body: input,
          headers: idempotencyHeaders(idempotencyKey),
        }),
      deletePushSubscription: (subscriptionId) =>
        request(`/api/users/me/push-subscriptions/${id(subscriptionId)}`, {
          method: "DELETE",
        }),
      list: (filters = {}) => request(`/api/notifications${query(filters)}`),
      markRead: (notificationId) =>
        request(`/api/notifications/${id(notificationId)}/read`, {
          method: "PATCH",
        }),
      markAllRead: () =>
        request("/api/notifications/read-all", { method: "POST" }),
    },
    support: {
      listNotices: (filters = {}) => request(`/api/notices${query(filters)}`),
      getNotice: (noticeId) => request(`/api/notices/${id(noticeId)}`),
      createInquiry: (input, idempotencyKey) =>
        request("/api/inquiries", {
          method: "POST",
          body: input,
          headers: idempotencyHeaders(idempotencyKey),
        }),
      listInquiries: (filters = {}) =>
        request(`/api/users/me/inquiries${query(filters)}`),
      getInquiry: (inquiryId) =>
        request(`/api/users/me/inquiries/${id(inquiryId)}`),
    },
  };
}
