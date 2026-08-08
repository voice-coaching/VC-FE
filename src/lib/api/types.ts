export type Id = number | string;

export type SocialProvider = "GOOGLE" | "KAKAO" | "NAVER" | "APPLE";
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
  email: string;
  nickname: string;
  status: UserStatus;
  loginProviders: Array<"LOCAL" | SocialProvider>;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: Id;
  email?: string;
  nickname: string;
  onboardingCompleted?: boolean;
}

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
  onboardingRequired: boolean;
  isNewUser?: boolean;
}

export interface SignUpInput {
  email: string;
  password: string;
  nickname: string;
  termsAgreed: boolean;
  privacyAgreed: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SocialLoginInput {
  provider: SocialProvider;
  authorizationCode: string;
  redirectUri: string;
}

export interface OnboardingSurveyAnswers {
  learningPurposes: string[];
  improvementAreas: string[];
  pronunciationConcerns: string[];
  learningSituations: string[];
}

export interface OnboardingProfile {
  currentLevel: CurrentLevel;
  goalText: string;
  dailyGoalMinutes: number;
  weeklyGoalCount: number;
  surveyAnswers: OnboardingSurveyAnswers;
  completedAt?: string;
}

export interface HomeDashboard {
  today: { completedCount: number; goalCount: number; learningSeconds: number };
  recommendations: Array<{
    contentId: Id;
    title: string;
    contentType: ContentType;
    reason: string;
  }>;
  recentTraining: {
    sessionId: Id;
    contentId: Id;
    title: string;
    status: TrainingSessionStatus;
  } | null;
  courseProgress: {
    courseId: Id;
    title: string;
    progressPercent: number;
  } | null;
}

export interface Recommendation {
  contentId: Id;
  contentType: ContentType;
  title: string;
  difficulty: Difficulty;
  reason: string;
}

export interface RecentTraining {
  sessionId: Id;
  contentId: Id;
  contentTitle: string;
  status: TrainingSessionStatus;
  resumeType: string;
  lastUpdatedAt: string;
}

export interface PracticeContentSummary {
  id: Id;
  contentType: ContentType;
  title: string;
  category: string;
  difficulty: Difficulty;
  estimatedSeconds: number;
}

export interface PracticeContent extends PracticeContentSummary {
  learningFocus: LearningFocus;
  description: string;
  scriptText: string;
  targetPronunciations: string[];
  referenceAudioAvailable: boolean;
}

export interface ReferenceAudio {
  id: Id;
  speakerName: string;
  speakerType: "ANNOUNCER" | "COACH" | "TTS";
  durationMs: number;
  primary: boolean;
}

export interface PlaybackUrl {
  audioId?: Id;
  recordingId?: Id;
  playbackUrl: string;
  expiresAt: string;
}

export interface CourseSummary {
  id: Id;
  courseType: CourseType;
  title: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  progressPercent: number;
}

export interface CourseDetail extends CourseSummary {
  description: string;
  stepCount: number;
  progress: {
    status: CourseProgressStatus | PublishStatus;
    progressPercent: number;
    lastStepId: Id | null;
  };
}

export interface CourseProgress {
  courseId: Id;
  status: CourseProgressStatus;
  lastStepId: Id | null;
  progressPercent: number;
  startedAt?: string;
  completedAt?: string | null;
}

export interface CourseStep {
  id: Id;
  stepOrder: number;
  stepType: CourseStepType;
  title: string;
  practiceContentId?: Id;
  completed: boolean;
}

export interface UserCourseProgress extends CourseProgress {
  title: string;
  updatedAt: string;
}

export interface TrainingSession {
  id?: Id;
  sessionId?: Id;
  contentId?: Id;
  courseStepId?: Id | null;
  learningFocus?: LearningFocus;
  status: TrainingSessionStatus;
  content?: { id: Id; title: string; scriptText: string };
  selectedRecordingId?: Id | null;
  recordingCount?: number;
  analysisAvailable?: boolean;
  startedAt: string;
}

export interface RecordingUploadUrl {
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

export interface VoiceRecording {
  id?: Id;
  recordingId?: Id;
  attemptNo: number;
  durationMs?: number;
  qualityStatus: RecordingQualityStatus;
  selected: boolean;
  createdAt?: string;
}

export interface AnalysisRequest {
  analysisId: Id;
  status: AnalysisStatus | TrainingSessionStatus;
  requestedAt: string;
  retryCount?: number;
}

export interface AnalysisProgress {
  analysisId: Id;
  status: AnalysisStatus;
  stage: string;
  progressPercent: number;
  failureReason: string | null;
  updatedAt: string;
}

export interface SessionAnalysis {
  sessionId: Id;
  analysisId: Id;
  status: AnalysisStatus;
  overallScore: number;
  pronunciationScore: number;
  intonationScore: number;
}

export interface AnalysisResult {
  id: Id;
  status: AnalysisStatus;
  transcript: string;
  sttConfidence: number;
  overallScore: number;
  pronunciationScore: number;
  intonationScore: number;
  speedWpm: number;
  speedStatus: SpeedStatus;
  stressScore: number;
  pauseScore: number;
  strengths: string[];
  weaknesses: string[];
  summaryFeedback: string;
  analyzedAt: string;
}

export interface AnalysisSegment {
  id: Id;
  sequenceNo: number;
  expectedText: string;
  recognizedText: string;
  startMs: number;
  endMs: number;
  matchType: SegmentMatchType;
  resultStatus: SegmentResultStatus;
  targetUnit: string;
  errorType: string;
  pronunciationScore: number;
  intonationScore: number;
  feedback: string;
}

export interface Statistics {
  period: { from: string; to: string };
  totalSessionCount: number;
  totalLearningSeconds: number;
  todaySessionCount: number;
  todayGoalCount: number;
  consecutiveLearningDays: number;
  averageOverallScore: number;
  averagePronunciationScore: number;
  averageIntonationScore: number;
}

export interface ScoreTrend {
  metric: string;
  points: Array<{ date: string; score: number; sessionCount: number }>;
}

export interface StrengthsWeaknesses {
  strengths: Array<{
    targetUnit: string;
    label: string;
    averageScore: number;
    attemptCount: number;
  }>;
  weaknesses: Array<{
    targetUnit: string;
    label: string;
    averageScore: number;
    attemptCount: number;
    commonErrorType: string;
  }>;
  minimumDataSatisfied: boolean;
}

export interface TrainingHistoryItem {
  sessionId: Id;
  contentId: Id;
  contentType: ContentType;
  title: string;
  status: TrainingSessionStatus;
  overallScore: number;
  completedAt: string;
}

export interface TrainingHistoryDetail {
  session: {
    id: Id;
    status: TrainingSessionStatus;
    startedAt: string;
    completedAt: string;
    totalLearningSeconds: number;
  };
  content: { id: Id; title: string; scriptText: string };
  recording: {
    id: Id;
    durationMs: number;
    qualityStatus: RecordingQualityStatus;
  };
  analysis: { id: Id; transcript: string; overallScore: number };
  segments: Array<{
    sequenceNo: number;
    expectedText: string;
    recognizedText: string;
    startMs: number;
    endMs: number;
    resultStatus: SegmentResultStatus;
  }>;
}

export interface WeaknessRecommendations {
  weaknesses: Array<{
    targetUnit: string;
    label: string;
    averageScore: number;
  }>;
  recommendations: Array<{
    targetType: "CONTENT" | "COURSE" | string;
    contentId?: Id;
    courseId?: Id;
    contentType?: ContentType;
    title: string;
    reason: string;
  }>;
}

export interface ApiContract {
  auth: {
    checkEmail(email: string): Promise<{ email: string; available: boolean }>;
    signUp(input: SignUpInput): Promise<AuthSession>;
    signIn(input: LoginInput): Promise<AuthSession>;
    socialLogin(input: SocialLoginInput): Promise<AuthSession>;
    refresh(): Promise<{
      accessToken: string;
      tokenType: string;
      expiresIn: number;
    }>;
    signOut(): Promise<void>;
  };
  users: {
    getMe(): Promise<UserAccount>;
    updateProfile(input: {
      nickname: string;
    }): Promise<{ id: Id; nickname: string; updatedAt: string }>;
    withdraw(): Promise<{ withdrawnAt: string }>;
  };
  onboarding: {
    get(): Promise<OnboardingProfile>;
    save(
      input: OnboardingProfile,
    ): Promise<{ completed: boolean; completedAt: string }>;
    update(input: Partial<OnboardingProfile>): Promise<{
      goalText: string;
      dailyGoalMinutes: number;
      updatedAt: string;
    }>;
  };
  home: {
    get(): Promise<HomeDashboard>;
    getRecommendations(filters?: {
      type?: ContentType;
      limit?: number;
    }): Promise<Recommendation[]>;
    getRecentTraining(): Promise<RecentTraining>;
  };
  content: {
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
    getRecommendations(
      id: Id,
      limit?: number,
    ): Promise<
      Array<{
        id: Id;
        title: string;
        contentType: ContentType;
        similarityReason: string;
      }>
    >;
    getReferenceAudios(id: Id): Promise<ReferenceAudio[]>;
    getReferenceAudioPlaybackUrl(audioId: Id): Promise<PlaybackUrl>;
  };
  courses: {
    list(filters?: {
      type?: CourseType;
      difficulty?: Difficulty;
      status?: PublishStatus;
      page?: number;
      size?: number;
    }): Promise<PageResult<CourseSummary>>;
    get(id: Id): Promise<CourseDetail>;
    start(id: Id): Promise<CourseProgress>;
    getProgress(id: Id): Promise<CourseProgress>;
    updateProgress(
      id: Id,
      input: { lastStepId: Id; progressPercent: number },
    ): Promise<CourseProgress>;
    complete(id: Id): Promise<CourseProgress & { completedAt: string }>;
    getSteps(id: Id): Promise<CourseStep[]>;
    getMyProgress(status?: CourseProgressStatus): Promise<UserCourseProgress[]>;
  };
  training: {
    create(input: {
      contentId: Id;
      courseStepId?: Id | null;
      learningFocus: LearningFocus;
    }): Promise<TrainingSession>;
    get(sessionId: Id): Promise<TrainingSession>;
    cancel(sessionId: Id): Promise<{
      sessionId: Id;
      status: TrainingSessionStatus;
      canceledAt: string;
    }>;
    getUploadUrl(
      sessionId: Id,
      input: { fileName: string; mimeType: string; fileSizeBytes: number },
    ): Promise<RecordingUploadUrl>;
    uploadRecording(
      upload: RecordingUploadUrl,
      audio: Blob,
      onProgress?: (percent: number) => void,
    ): Promise<void>;
    registerRecording(
      sessionId: Id,
      input: {
        objectKey: string;
        mimeType: string;
        fileSizeBytes: number;
        durationMs: number;
      },
    ): Promise<VoiceRecording>;
    listRecordings(sessionId: Id): Promise<VoiceRecording[]>;
    deleteRecording(sessionId: Id, recordingId: Id): Promise<void>;
    selectRecording(
      sessionId: Id,
      recordingId: Id,
    ): Promise<{ sessionId: Id; selectedRecordingId: Id; selectedAt: string }>;
    analyze(sessionId: Id): Promise<AnalysisRequest>;
    getAnalysisStatus(sessionId: Id): Promise<AnalysisProgress>;
    retryAnalysis(sessionId: Id): Promise<AnalysisRequest>;
    getSessionAnalysis(sessionId: Id): Promise<SessionAnalysis>;
    getRecordingPlaybackUrl(recordingId: Id): Promise<PlaybackUrl>;
    complete(
      sessionId: Id,
      totalLearningSeconds: number,
    ): Promise<{
      sessionId: Id;
      status: TrainingSessionStatus;
      completedAt: string;
    }>;
  };
  analyses: {
    get(analysisId: Id): Promise<AnalysisResult>;
    getSegments(
      analysisId: Id,
      filters?: { page?: number; size?: number },
    ): Promise<PageResult<AnalysisSegment>>;
    regenerateFeedback(
      analysisId: Id,
      feedbackStyle: string,
    ): Promise<{
      analysisId: Id;
      strengths: string[];
      weaknesses: string[];
      summaryFeedback: string;
      regeneratedAt: string;
    }>;
  };
  myPage: {
    getStatistics(filters?: {
      period?: string;
      from?: string;
      to?: string;
    }): Promise<Statistics>;
    getScoreTrends(metric: string, period?: string): Promise<ScoreTrend>;
    getStrengthsWeaknesses(filters?: {
      period?: string;
      limit?: number;
    }): Promise<StrengthsWeaknesses>;
    listTrainingSessions(filters?: {
      type?: ContentType;
      status?: TrainingSessionStatus;
      from?: string;
      to?: string;
      page?: number;
      size?: number;
    }): Promise<PageResult<TrainingHistoryItem>>;
    getTrainingSession(sessionId: Id): Promise<TrainingHistoryDetail>;
    deleteTrainingSession(sessionId: Id): Promise<void>;
    getWeaknessRecommendations(filters?: {
      limit?: number;
      contentType?: ContentType;
    }): Promise<WeaknessRecommendations>;
  };
}
