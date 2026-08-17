import { clearTokens, createHttpClient, getRefreshToken, saveTokens } from "./client";
import type {
  AnalysisResult,
  ApiContract,
  AuthSession,
  ClassSummary,
  ContentFilters,
  LearningContent,
  LearningHistoryItem,
  MyPageSnapshot,
  OnboardingAnswers,
  UserAccount,
} from "./types";

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

export function createRemoteApi(baseUrl: string): ApiContract {
  const { request } = createHttpClient(baseUrl.replace(/\/$/, ""));

  async function persistSession(promise: Promise<AuthSession>) {
    const session = await promise;
    saveTokens(session.accessToken, session.refreshToken);
    return session;
  }

  return {
    auth: {
<<<<<<< Updated upstream
      checkEmail: (email) => request(`/auth/email/check${query({ email })}`, { skipAuth: true }),
      signUp: (input) =>
        persistSession(request("/auth/signup", { method: "POST", body: input, skipAuth: true })),
      signIn: (input) =>
        persistSession(request("/auth/login", { method: "POST", body: input, skipAuth: true })),
      socialLogin: (provider) => request(`/auth/social/${provider}`, { skipAuth: true }),
      getSession: () => request<AuthSession | null>("/auth/session"),
      refresh: () =>
        persistSession(
          request("/auth/refresh", {
            method: "POST",
            body: { refreshToken: getRefreshToken() },
            skipAuth: true,
          }),
        ),
=======
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
          user: { id: Id; email?: string; nickname: string };
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
>>>>>>> Stashed changes
      async signOut() {
        try {
          await request("/auth/logout", { method: "POST" });
        } finally {
          clearTokens();
        }
      },
      async withdraw() {
        await request("/account", { method: "DELETE" });
        clearTokens();
      },
    },
    onboarding: {
      get: () => request<OnboardingAnswers | null>("/onboarding"),
      save: (input) => request("/onboarding", { method: "PUT", body: input }),
    },
    content: {
<<<<<<< Updated upstream
      list: (filters: ContentFilters = {}) =>
        request(`/contents${query(filters as Record<string, string | number | undefined>)}`),
      get: (id) => request(`/contents/${encodeURIComponent(id)}`),
      getRecommendations: () => request<LearningContent[]>("/contents/recommendations"),
      getNext: (id) => request<LearningContent | null>(`/contents/${encodeURIComponent(id)}/next`),
      getPrevious: (id) =>
        request<LearningContent | null>(`/contents/${encodeURIComponent(id)}/previous`),
      getReferenceAudio: (id) => request(`/contents/${encodeURIComponent(id)}/reference-audio`),
=======
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
      async getReferenceAudios(contentId) {
        const data = await request<{ items: ReferenceAudio[] }>(
          `/api/practice-contents/${id(contentId)}/reference-audios`,
        );
        return data.items;
      },
      getReferenceAudioPlaybackUrl: (audioId) =>
        request(`/api/reference-audios/${id(audioId)}/playback-url`),
>>>>>>> Stashed changes
    },
    practice: {
      async analyze(input, options) {
        const form = new FormData();
        form.set("contentId", input.contentId);
        form.set("script", input.script);
        form.set("category", input.category);
        form.set("durationMs", String(input.durationMs));
        form.set("audio", input.audio, `recording-${Date.now()}.webm`);
        options?.onUploadProgress?.(10);
        const result = await request<AnalysisResult>("/analyses", {
          method: "POST",
          body: form,
          timeoutMs: 60_000,
        });
        options?.onUploadProgress?.(100);
        return result;
      },
      retryAnalysis: (analysisId) =>
        request(`/analyses/${encodeURIComponent(analysisId)}/retry`, {
          method: "POST",
          timeoutMs: 60_000,
        }),
      getResult: (analysisId) => request(`/analyses/${encodeURIComponent(analysisId)}`),
      complete: (analysisId) =>
        request(`/analyses/${encodeURIComponent(analysisId)}/complete`, { method: "POST" }),
    },
    classes: {
      list: (category?: ClassSummary["category"]) => request(`/classes${query({ category })}`),
      get: (id) => request(`/classes/${encodeURIComponent(id)}`),
      saveProgress: (id, step) =>
        request(`/classes/${encodeURIComponent(id)}/progress`, { method: "PUT", body: { step } }),
    },
    myPage: {
      getSnapshot: () => request<MyPageSnapshot>("/me/summary"),
      updateProfile: (input) =>
        request<UserAccount>("/me/profile", { method: "PATCH", body: input }),
      listHistory: (filters = {}) =>
        request<LearningHistoryItem[]>(
          `/me/history${query(filters as Record<string, string | undefined>)}`,
        ),
      getHistory: (id) => request(`/me/history/${encodeURIComponent(id)}`),
    },
  };
}
