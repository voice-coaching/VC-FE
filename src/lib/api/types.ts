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
export type AnalysisOutcome =
  | "COACHING_READY"
  | "COMPLETED_NO_ISSUE"
  | "RERECORD_REQUIRED"
  | "UNCERTAIN"
  | "FAILED_CLOSED";
export type SegmentMatchType =
  "MATCH" | "SUBSTITUTION" | "OMISSION" | "ADDITION";
export type SegmentResultStatus = "NORMAL" | "CAUTION" | "NEEDS_IMPROVEMENT";
export type SpeedStatus = "TOO_SLOW" | "NORMAL" | "TOO_FAST" | "SLOW" | "FAST";
export type UserTitleCode =
  | "ABSOLUTE_BEGINNER"
  | "BEGINNER"
  | "LOCAL_ANNOUNCER"
  | "ASPIRING_ANNOUNCER"
  | "ANNOUNCER";
export type UserTitleLabel =
  "왕초보" | "초보" | "동네 아나운서" | "아나운서 지망생" | "아나운서";

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
  nickname: string;
  profileImageUrl: string | null;
  status: UserStatus;
  loginProviders: Array<"LOCAL" | SocialProvider>;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface ProfileImage {
  id: Id;
  imageUrl: string;
  originalFileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  updatedAt: string;
}

export interface ProfileImageInput {
  file: Blob;
  fileName: string;
}

export interface UserTitleProgress {
  code: UserTitleCode;
  label: UserTitleLabel;
  completedTrainingCount: number;
  minimumTrainingCount: number;
  next: {
    code: UserTitleCode;
    label: UserTitleLabel;
    requiredTrainingCount: number;
    remainingTrainingCount: number;
    passingScore: number;
    eligible: boolean;
  } | null;
  updatedAt: string;
}

export type TitleExamStatus = "READY" | "IN_PROGRESS" | "PASSED" | "FAILED";

export interface UserTitleExam {
  id: Id;
  currentTitle: UserTitleLabel;
  targetTitle: UserTitleLabel;
  practiceContentId: Id;
  requiredTrainingCount: number;
  passingScore: number;
  status: TitleExamStatus;
  createdAt: string;
}

export interface UserTitleExamResult {
  examId: Id;
  status: Extract<TitleExamStatus, "PASSED" | "FAILED">;
  score: number;
  passingScore: number;
  passed: boolean;
  previousTitle: UserTitleLabel;
  currentTitle: UserTitleLabel;
  evaluatedAt: string;
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
  state: string;
}

export interface OnboardingSurveyAnswers {
  learningPurposes: string[];
  improvementAreas: string[];
  pronunciationConcerns: string[];
  learningSituations: string[];
}

export interface OnboardingSaveInput {
  currentLevel: CurrentLevel;
  goalText?: string | null;
  dailyGoalMinutes?: number | null;
  weeklyGoalCount?: number | null;
  surveyAnswers: OnboardingSurveyAnswers;
}

export interface OnboardingProfile {
  currentLevel: CurrentLevel;
  goalText: string | null;
  dailyGoalMinutes: number | null;
  weeklyGoalCount: number | null;
  surveyAnswers: OnboardingSurveyAnswers;
  completedAt: string;
}

// PATCH leaves omitted/null fields unchanged, including individual survey lists.
export interface OnboardingUpdateInput {
  goalText?: string | null;
  dailyGoalMinutes?: number | null;
  weeklyGoalCount?: number | null;
  surveyAnswers?:
    | {
        [Key in keyof OnboardingSurveyAnswers]?: string[] | null;
      }
    | null;
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

export interface PracticeContentRecommendation {
  id: Id;
  title: string;
  contentType: ContentType;
  similarityReason: string;
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

export interface AnalysisCapabilities {
  recordingUpload: "CONFIGURED" | "NOT_CONFIGURED";
  analysisRequests: "CONFIGURED" | "NOT_CONFIGURED";
  supportedLearningFocuses: LearningFocus[];
  acceptedAudioMimeTypes: string[];
  acceptedVideoMimeTypes: string[];
  maximumAudioUploadBytes: number;
  maximumVideoUploadBytes: number;
  minimumDurationMs: number;
  maximumDurationMs: number;
  videoRequiresAudioTrack: boolean;
  voiceProcessingConsentRequired: boolean;
  videoProcessingConsentRequired: boolean;
  consentPolicyRevision: string | null;
  videoProcessingConsentPolicyRevision: string;
}

export interface AnalysisConsentInput {
  accepted: true;
  policyRevision: string;
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
  outcome: AnalysisOutcome | null;
  overallScore: number | null;
  pronunciationScore: number | null;
  intonationScore: number | null;
}

export interface PronunciationEvidence {
  schemaVersion: "voice-coaching.pronunciation-evidence.v1" | string;
  selectedPhone: string;
  selectedExpectedIndex: number;
  selectedStartMs: number | null;
  selectedEndMs: number | null;
  detectorScore: number;
  operatingThreshold: number;
  scoreSemantics: string;
  evidenceState: string;
}

export interface VisualSupplement {
  schemaVersion: "voice-coaching.visual-supplement.v1" | string;
  selectedExpectedIndex: number;
  evidenceRelation: string;
  approvedClaimId: string;
  rendererKey: string;
  upstreamPhoneAnchorRef: string;
  supplementSha256: string;
  closedBetaLipObservation: object | null;
}

export interface AnalysisResult {
  id: Id;
  status: AnalysisStatus;
  outcome: AnalysisOutcome | null;
  transcript: string | null;
  sttConfidence: number | null;
  overallScore: number | null;
  pronunciationScore: number | null;
  intonationScore: number | null;
  speedWpm: number | null;
  speedStatus: SpeedStatus | null;
  stressScore: number | null;
  pauseScore: number | null;
  strengths: string[];
  weaknesses: string[];
  summaryFeedback: string | null;
  pronunciationEvidence: PronunciationEvidence | null;
  visualSupplement: VisualSupplement | null;
  analyzedAt: string | null;
}

export interface AnalysisSegment {
  id: Id;
  sequenceNo: number;
  expectedText: string | null;
  recognizedText: string | null;
  startMs: number | null;
  endMs: number | null;
  matchType: SegmentMatchType;
  resultStatus: SegmentResultStatus;
  targetUnit: string | null;
  errorType: string | null;
  pronunciationScore: number | null;
  intonationScore: number | null;
  feedback: string | null;
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
  overallScore: number | null;
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
  analysis: {
    id: Id;
    transcript: string | null;
    overallScore: number | null;
  };
  segments: Array<{
    sequenceNo: number;
    expectedText: string | null;
    recognizedText: string | null;
    startMs: number | null;
    endMs: number | null;
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

export interface PracticeExample {
  id: string;
  order: number;
  text: string;
  hint: string | null;
  focus: LearningFocus | null;
  locale: string;
  practiceContentId: Id;
}

export interface PracticeExamples {
  courseId: Id;
  stepId: Id;
  revision: number;
  items: PracticeExample[];
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
    getProfileImage(): Promise<ProfileImage | null>;
    createProfileImage(input: ProfileImageInput): Promise<ProfileImage>;
    updateProfileImage(input: ProfileImageInput): Promise<ProfileImage>;
    deleteProfileImage(): Promise<void>;
    getTitle(): Promise<UserTitleProgress>;
    createTitleExam(): Promise<UserTitleExam>;
    getTitleExam(examId: Id): Promise<UserTitleExam>;
    submitTitleExam(examId: Id, analysisId: Id): Promise<UserTitleExamResult>;
    withdraw(): Promise<{ withdrawnAt: string }>;
  };
  onboarding: {
    get(): Promise<OnboardingProfile>;
    save(
      input: OnboardingSaveInput,
    ): Promise<{ completed: boolean; completedAt: string }>;
    update(input: OnboardingUpdateInput): Promise<{
      goalText: string | null;
      dailyGoalMinutes: number | null;
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
    createCustom(
      input: {
        title: string;
        scriptText: string;
        learningFocus: LearningFocus;
        retention: "SESSION_HISTORY";
        locale: "ko-KR";
      },
      idempotencyKey: string,
    ): Promise<PracticeContent>;
    getNext(filters: {
      type: ContentType;
      category?: string;
      difficulty?: Difficulty;
      excludeId?: Id;
    }): Promise<PracticeContent>;
    getRecommendations(id: Id): Promise<PracticeContentRecommendation[]>;
    getReferenceAudios(id: Id): Promise<ReferenceAudio[]>;
    getReferenceAudioPlaybackUrl(audioId: Id): Promise<PlaybackUrl>;
  };
  examples: {
    list(courseId: Id, stepId: Id, sessionId?: Id): Promise<PracticeExamples>;
    getAudio(exampleId: string, signal?: AbortSignal): Promise<Blob>;
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
    getAnalysisCapabilities(): Promise<AnalysisCapabilities>;
    create(input: {
      contentId: Id;
      courseStepId?: Id | null;
      titleExamId?: Id | null;
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
    analyze(
      sessionId: Id,
      consent: AnalysisConsentInput,
    ): Promise<AnalysisRequest>;
    getAnalysisStatus(sessionId: Id): Promise<AnalysisProgress>;
    retryAnalysis(
      sessionId: Id,
      consent: AnalysisConsentInput,
    ): Promise<AnalysisRequest>;
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
      feedbackStyle: "COACHING",
    ): Promise<{
      analysisId: Id;
      strengths: string[];
      weaknesses: string[];
      summaryFeedback: string | null;
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
