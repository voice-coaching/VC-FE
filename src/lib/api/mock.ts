import {
  AI_STRENGTHS,
  AI_WEAKNESSES,
  SENTENCES,
  type OnboardingProfile,
  type PracticeSentence,
} from "@/lib/app-data";
import { clearTokens, saveTokens } from "./client";
import type {
  AnalysisResult,
  ApiContract,
  AuthSession,
  ClassSummary,
  ContentFilters,
  LearningContent,
  LearningHistoryItem,
  OnboardingAnswers,
  RecordingAnalysisInput,
  UserAccount,
} from "./types";

const SESSION_KEY = "ttobak.mock.session";
const PROFILE_KEY = "voco.profile";
const ONBOARDING_KEY = "ttobak.onboarding";
const HISTORY_KEY = "ttobak.mock.history";
const ANALYSIS_KEY = "ttobak.mock.analysis";

const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
}

function sessionFor(
  email: string,
  nickname = "또박이",
  provider: UserAccount["provider"] = "email",
) {
  const session: AuthSession = {
    accessToken: `mock-access-${Date.now()}`,
    refreshToken: "mock-refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: {
      id: "mock-user",
      email,
      nickname,
      provider,
      onboardingCompleted: Boolean(read(PROFILE_KEY)),
    },
  };
  write(SESSION_KEY, session);
  saveTokens(session.accessToken, session.refreshToken);
  return session;
}

function asContent(sentence: PracticeSentence): LearningContent {
  const kind = sentence.category === "custom" ? "sentence" : sentence.category;
  return {
    ...sentence,
    kind,
    description: sentence.title,
    difficulty: sentence.id.endsWith("1") ? "beginner" : "intermediate",
    source: sentence.category === "news" ? "또박 데일리 뉴스" : undefined,
    tags: [sentence.category, sentence.title],
    estimatedMinutes: 3,
  };
}

function makeAnalysis(input: RecordingAnalysisInput): AnalysisResult {
  const source = SENTENCES.find((item) => item.id === input.contentId);
  const fallback = source ?? buildCustomSentence(input.script, input.category);
  const scores = fallback.syllables.filter((item) => item.text.trim()).map((item) => item.score);
  const pronunciationScore = Math.round(
    scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length),
  );
  return {
    id: `analysis-${Date.now()}`,
    contentId: input.contentId,
    script: fallback.script,
    recognized: fallback.recognized,
    syllables: fallback.syllables,
    quality: {
      analyzable: input.durationMs >= 1_000,
      durationMs: input.durationMs,
      volume: "normal",
      noise: "low",
      message: input.durationMs < 1_000 ? "녹음이 너무 짧습니다. 다시 녹음해 주세요." : undefined,
    },
    metrics: {
      pronunciationScore,
      intonationScore: Math.max(0, pronunciationScore - 3),
      speedWpm: 128,
      speedStatus: "good",
    },
    strengths: AI_STRENGTHS,
    weaknesses: AI_WEAKNESSES.slice(0, 2),
    recommendationIds: ["pron-1"],
    createdAt: new Date().toISOString(),
  };
}

function buildCustomSentence(
  script: string,
  category: PracticeSentence["category"],
): PracticeSentence {
  let index = 0;
  const syllables = script.split("").map((text) => {
    if (!text.trim()) return { text, score: 100 };
    const score = 58 + ((text.charCodeAt(0) * 7 + index++ * 13) % 42);
    return {
      text,
      score,
      note: score < 70 ? "이 음절이 흐리게 들려요. 입모양을 크게 해보세요." : undefined,
    };
  });
  return {
    id: "custom",
    category,
    title: "내가 넣은 문장",
    announcer: "AI 아나운서 음성",
    script,
    recognized: script
      .split(" ")
      .map((word, i) => (i % 4 === 3 ? word.slice(0, -1) : word))
      .join(" "),
    syllables,
  };
}

const classes: ClassSummary[] = [
  {
    id: "pronunciation-basic",
    title: "발음 기초",
    description: "받침과 자음 발음 원리를 익혀요.",
    category: "pronunciation",
    difficulty: "beginner",
    progress: 35,
    estimatedMinutes: 15,
    steps: ["theory", "listen", "record", "result"],
  },
  {
    id: "intonation-basic",
    title: "억양 기초",
    description: "문장 끝과 강조 억양을 익혀요.",
    category: "intonation",
    difficulty: "intermediate",
    progress: 10,
    estimatedMinutes: 18,
    steps: ["theory", "listen", "record", "result"],
  },
];

export const mockApi: ApiContract = {
  auth: {
    async checkEmail(email) {
      await wait();
      return { available: !email.toLowerCase().startsWith("used") };
    },
    async signUp(input) {
      await wait();
      return sessionFor(input.email, input.nickname);
    },
    async signIn(input) {
      await wait();
      return sessionFor(input.email);
    },
    async socialLogin(provider) {
      await wait();
      return { session: sessionFor(`${provider}@example.com`, "또박이", provider) };
    },
    async getSession() {
      await wait(100);
      return read<AuthSession>(SESSION_KEY);
    },
    async refresh() {
      await wait();
      const current = read<AuthSession>(SESSION_KEY);
      return sessionFor(current?.user.email ?? "mock@example.com", current?.user.nickname);
    },
    async signOut() {
      await wait(150);
      clearTokens();
      if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
    },
    async withdraw() {
      await wait();
      clearTokens();
      if (typeof window !== "undefined")
        [SESSION_KEY, PROFILE_KEY, ONBOARDING_KEY, HISTORY_KEY, ANALYSIS_KEY].forEach((key) =>
          window.localStorage.removeItem(key),
        );
    },
  },
  onboarding: {
    async get() {
      await wait(100);
      const full = read<OnboardingAnswers>(ONBOARDING_KEY);
      if (full) return full;
      const legacy = read<OnboardingProfile>(PROFILE_KEY);
      return legacy
        ? { ...legacy, improvementAreas: [], pronunciationConcerns: [], learningSituations: [] }
        : null;
    },
    async save(input) {
      await wait();
      write(ONBOARDING_KEY, input);
      write(PROFILE_KEY, input);
      return input;
    },
  },
  content: {
    async list(filters: ContentFilters = {}) {
      await wait(150);
      let items = SENTENCES.map(asContent);
      if (filters.kind === "sentence")
        items = items
          .filter((item) => item.category === "pronunciation")
          .map((item) => ({ ...item, kind: "sentence" as const }));
      else if (filters.kind === "announcer")
        items = items
          .filter((item) => item.category === "news")
          .map((item) => ({ ...item, kind: "announcer" as const }));
      else if (filters.kind) items = items.filter((item) => item.kind === filters.kind);
      if (filters.category) items = items.filter((item) => item.tags.includes(filters.category!));
      if (filters.difficulty)
        items = items.filter((item) => item.difficulty === filters.difficulty);
      return { items: items.slice(0, filters.limit ?? items.length), nextCursor: null };
    },
    async get(id) {
      await wait(100);
      const item = SENTENCES.find((s) => s.id === id);
      if (!item) throw new Error("콘텐츠를 찾을 수 없습니다.");
      return asContent(item);
    },
    async getRecommendations() {
      await wait(100);
      return SENTENCES.slice(0, 3).map(asContent);
    },
    async getNext(id) {
      const index = SENTENCES.findIndex((s) => s.id === id);
      return index >= 0 && index < SENTENCES.length - 1 ? asContent(SENTENCES[index + 1]) : null;
    },
    async getPrevious(id) {
      const index = SENTENCES.findIndex((s) => s.id === id);
      return index > 0 ? asContent(SENTENCES[index - 1]) : null;
    },
    async getReferenceAudio() {
      await wait(100);
      return { url: null };
    },
  },
  practice: {
    async analyze(input, options) {
      options?.onUploadProgress?.(15);
      await wait(250);
      options?.onUploadProgress?.(55);
      await wait(450);
      options?.onUploadProgress?.(100);
      const result = makeAnalysis(input);
      write(ANALYSIS_KEY, result);
      const history = read<LearningHistoryItem[]>(HISTORY_KEY) ?? [];
      history.unshift({
        id: `history-${Date.now()}`,
        kind: input.category === "custom" ? "sentence" : input.category,
        title: SENTENCES.find((s) => s.id === input.contentId)?.title ?? "내 문장 연습",
        score: result.metrics.pronunciationScore,
        minutes: Math.max(1, Math.round(input.durationMs / 60_000)),
        completedAt: result.createdAt,
        analysisId: result.id,
      });
      write(HISTORY_KEY, history);
      return result;
    },
    async retryAnalysis() {
      await wait(600);
      const result = read<AnalysisResult>(ANALYSIS_KEY);
      if (!result) throw new Error("재분석할 결과가 없습니다.");
      return { ...result, createdAt: new Date().toISOString() };
    },
    async getResult() {
      await wait(100);
      const result = read<AnalysisResult>(ANALYSIS_KEY);
      if (!result) throw new Error("분석 결과가 없습니다.");
      return result;
    },
    async complete() {
      await wait(100);
    },
  },
  classes: {
    async list(category) {
      await wait(100);
      return category ? classes.filter((item) => item.category === category) : classes;
    },
    async get(id) {
      await wait(100);
      const item = classes.find((entry) => entry.id === id);
      if (!item) throw new Error("클래스를 찾을 수 없습니다.");
      return item;
    },
    async saveProgress(id, step) {
      const item = await this.get(id);
      item.progress = Math.min(100, Math.round(((step + 1) / item.steps.length) * 100));
      return item;
    },
  },
  myPage: {
    async getSnapshot() {
      await wait(100);
      const session = read<AuthSession>(SESSION_KEY) ?? sessionFor("mock@example.com");
      const profile = await mockApi.onboarding.get();
      const history = read<LearningHistoryItem[]>(HISTORY_KEY) ?? [];
      return {
        account: session.user,
        profile,
        strengths: AI_STRENGTHS,
        weaknesses: AI_WEAKNESSES,
        totalSessions: history.length || 42,
        totalMinutes: history.reduce((sum, item) => sum + item.minutes, 0) || 180,
        streakDays: 7,
        scoreTrend: history
          .slice(0, 7)
          .map((item) => ({ date: item.completedAt.slice(5, 10), score: item.score })),
      };
    },
    async updateProfile(input) {
      const session = read<AuthSession>(SESSION_KEY) ?? sessionFor("mock@example.com");
      session.user = { ...session.user, ...input };
      write(SESSION_KEY, session);
      return session.user;
    },
    async listHistory(filters = {}) {
      let items = read<LearningHistoryItem[]>(HISTORY_KEY) ?? [];
      if (filters.kind) items = items.filter((item) => item.kind === filters.kind);
      if (filters.from) items = items.filter((item) => item.completedAt >= filters.from!);
      if (filters.to) items = items.filter((item) => item.completedAt <= filters.to!);
      return items;
    },
    async getHistory(id) {
      const item = (read<LearningHistoryItem[]>(HISTORY_KEY) ?? []).find(
        (entry) => entry.id === id,
      );
      if (!item) throw new Error("학습 기록을 찾을 수 없습니다.");
      return { ...item, analysis: read<AnalysisResult>(ANALYSIS_KEY) ?? undefined };
    },
  },
};
