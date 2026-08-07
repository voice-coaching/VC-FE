import type {
  Goal,
  Level,
  OnboardingProfile,
  PracticeSentence,
  SyllableFeedback,
} from "@/lib/app-data";

export type SocialProvider = "kakao" | "google" | "naver" | "apple";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type ContentKind = "news" | "sentence" | "announcer" | "pronunciation" | "intonation";

export interface UserAccount {
  id: string;
  email: string;
  nickname: string;
  provider: "email" | SocialProvider;
  onboardingCompleted: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  user: UserAccount;
}

export interface SignUpInput {
  email: string;
  password: string;
  nickname: string;
  requiredTermsAccepted: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SocialLoginResult {
  authorizationUrl?: string;
  session?: AuthSession;
}

export interface OnboardingAnswers extends OnboardingProfile {
  improvementAreas: string[];
  pronunciationConcerns: string[];
  learningSituations: string[];
  weeklySessions?: number;
  goalDescription?: string;
}

export interface LearningContent extends PracticeSentence {
  kind: ContentKind;
  description: string;
  difficulty: Difficulty;
  source?: string;
  referenceAudioUrl?: string;
  tags: string[];
  estimatedMinutes: number;
}

export interface ContentFilters {
  kind?: ContentKind;
  category?: string;
  difficulty?: Difficulty;
  cursor?: string;
  limit?: number;
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface RecordingAnalysisInput {
  contentId: string;
  script: string;
  category: PracticeSentence["category"];
  audio: Blob;
  durationMs: number;
}

export interface VoiceQuality {
  analyzable: boolean;
  durationMs: number;
  volume: "low" | "normal" | "high";
  noise: "low" | "medium" | "high";
  message?: string;
}

export interface SpeechMetrics {
  pronunciationScore: number;
  intonationScore?: number;
  speedWpm?: number;
  speedStatus?: "slow" | "good" | "fast";
}

export interface AnalysisResult {
  id: string;
  contentId: string;
  script: string;
  recognized: string;
  syllables: SyllableFeedback[];
  quality: VoiceQuality;
  metrics: SpeechMetrics;
  strengths: string[];
  weaknesses: string[];
  recommendationIds: string[];
  recordingUrl?: string;
  createdAt: string;
}

export interface ClassSummary {
  id: string;
  title: string;
  description: string;
  category: "pronunciation" | "intonation";
  difficulty: Difficulty;
  progress: number;
  estimatedMinutes: number;
  steps: Array<"theory" | "listen" | "record" | "result">;
}

export interface LearningHistoryItem {
  id: string;
  kind: ContentKind;
  title: string;
  score: number;
  minutes: number;
  completedAt: string;
  analysisId?: string;
}

export interface MyPageSnapshot {
  account: UserAccount;
  profile: OnboardingAnswers | null;
  strengths: string[];
  weaknesses: string[];
  totalSessions: number;
  totalMinutes: number;
  streakDays: number;
  scoreTrend: Array<{ date: string; score: number }>;
}

export interface ApiContract {
  auth: {
    checkEmail(email: string): Promise<{ available: boolean }>;
    signUp(input: SignUpInput): Promise<AuthSession>;
    signIn(input: LoginInput): Promise<AuthSession>;
    socialLogin(provider: SocialProvider): Promise<SocialLoginResult>;
    getSession(): Promise<AuthSession | null>;
    refresh(): Promise<AuthSession>;
    signOut(): Promise<void>;
    withdraw(): Promise<void>;
  };
  onboarding: {
    get(): Promise<OnboardingAnswers | null>;
    save(input: OnboardingAnswers): Promise<OnboardingAnswers>;
  };
  content: {
    list(filters?: ContentFilters): Promise<PageResult<LearningContent>>;
    get(id: string): Promise<LearningContent>;
    getRecommendations(): Promise<LearningContent[]>;
    getNext(id: string): Promise<LearningContent | null>;
    getPrevious(id: string): Promise<LearningContent | null>;
    getReferenceAudio(id: string): Promise<{ url: string | null }>;
  };
  practice: {
    analyze(
      input: RecordingAnalysisInput,
      options?: { onUploadProgress?: (percent: number) => void },
    ): Promise<AnalysisResult>;
    retryAnalysis(analysisId: string): Promise<AnalysisResult>;
    getResult(analysisId: string): Promise<AnalysisResult>;
    complete(analysisId: string): Promise<void>;
  };
  classes: {
    list(category?: ClassSummary["category"]): Promise<ClassSummary[]>;
    get(id: string): Promise<ClassSummary>;
    saveProgress(id: string, step: number): Promise<ClassSummary>;
  };
  myPage: {
    getSnapshot(): Promise<MyPageSnapshot>;
    updateProfile(input: Partial<Pick<UserAccount, "nickname">>): Promise<UserAccount>;
    listHistory(filters?: {
      kind?: ContentKind;
      from?: string;
      to?: string;
    }): Promise<LearningHistoryItem[]>;
    getHistory(id: string): Promise<LearningHistoryItem & { analysis?: AnalysisResult }>;
  };
}

export type { Goal, Level };
