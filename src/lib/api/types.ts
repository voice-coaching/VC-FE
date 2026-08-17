import type {
  Goal,
  Level,
  OnboardingProfile,
  PracticeSentence,
  SyllableFeedback,
} from "@/lib/app-data";

<<<<<<< Updated upstream
export type SocialProvider = "kakao" | "google" | "naver" | "apple";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type ContentKind = "news" | "sentence" | "announcer" | "pronunciation" | "intonation";

export interface UserAccount {
  id: string;
  email: string;
=======
export type SocialProvider = "GOOGLE" | "KAKAO";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "WITHDRAWN";
export type CurrentLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type ContentType = "NEWS" | "SENTENCE" | "ANNOUNCER" | "CLASS_PRACTICE";
export type LearningFocus = "PRONUNCIATION" | "INTONATION" | "BOTH";
export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type PublishStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";
export type CourseType = "PRONUNCIATION" | "INTONATION";
export type CourseStepType =
  "THEORY" | "AUDIO_EXAMPLE" | "PRACTICE" | "RESULT_REVIEW";
export type CourseProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type TrainingSessionStatus =
  "RECORDING" | "UPLOADING" | "ANALYZING" | "COMPLETED" | "FAILED" | "CANCELED";
export type RecordingQualityStatus =
  | "PENDING"
  | "PASS"
  | "LOW_VOLUME"
  | "TOO_NOISY"
  | "TOO_SHORT"
  | "NO_SPEECH"
  | "FAILED";
export type AnalysisStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type SegmentMatchType =
  "MATCH" | "SUBSTITUTION" | "OMISSION" | "ADDITION";
export type SegmentResultStatus = "NORMAL" | "CAUTION" | "NEEDS_IMPROVEMENT";
export type SpeedStatus = "TOO_SLOW" | "NORMAL" | "TOO_FAST" | "SLOW" | "FAST";

export interface ApiEnvelope<T> {
  result: boolean;
  message: string;
  data: T;
  code?: string;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages?: number;
  hasNext?: boolean;
}

export interface UserAccount {
  id: Id;
  email: string | null;
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    list(filters?: ContentFilters): Promise<PageResult<LearningContent>>;
    get(id: string): Promise<LearningContent>;
    getRecommendations(): Promise<LearningContent[]>;
    getNext(id: string): Promise<LearningContent | null>;
    getPrevious(id: string): Promise<LearningContent | null>;
    getReferenceAudio(id: string): Promise<{ url: string | null }>;
=======
    list(filters?: {
      type?: ContentType;
      category?: string;
      difficulty?: Difficulty;
      focus?: LearningFocus;
      page?: number;
      size?: number;
    }): Promise<PageResult<PracticeContentSummary>>;
    get(id: Id): Promise<PracticeContent>;
    getNext(filters: {
      type: ContentType;
      category?: string;
      difficulty?: Difficulty;
      excludeId?: Id;
    }): Promise<PracticeContent>;
    getReferenceAudios(id: Id): Promise<ReferenceAudio[]>;
    getReferenceAudioPlaybackUrl(audioId: Id): Promise<PlaybackUrl>;
>>>>>>> Stashed changes
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
