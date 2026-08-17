import { ApiError, clearAccessToken, saveAccessToken } from "./client";
import type {
  AnalysisResult,
  AnalysisSegment,
  ApiContract,
  AuthSession,
  CourseDetail,
  CourseProgress,
  CourseStep,
  CourseSummary,
  HomeDashboard,
  Id,
  OnboardingProfile,
  PageResult,
  PracticeContent,
  ReferenceAudio,
  Statistics,
  StrengthsWeaknesses,
  TrainingHistoryDetail,
  TrainingHistoryItem,
  TrainingSession,
  UserAccount,
  UserCourseProgress,
  VoiceRecording,
  WeaknessRecommendations,
} from "./types";

const NOW = "2026-08-08T12:00:00.000Z";
const DEV_TOKEN = "ttobak-local-development-token";
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const contents: PracticeContent[] = [
  {
    id: 101,
    contentType: "NEWS",
    title: "정부는 오늘 물가 안정을 위한 추가 대책을 발표했습니다.",
    category: "오늘의 뉴스",
    difficulty: "BEGINNER",
    learningFocus: "BOTH",
    description: "뉴스 문장으로 정확한 발음과 안정적인 억양을 연습합니다.",
    scriptText: "정부는 오늘 물가 안정을 위한 추가 대책을 발표했습니다.",
    targetPronunciations: ["FORTIS", "FINAL_CONSONANT"],
    estimatedSeconds: 45,
    referenceAudioAvailable: true,
  },
  {
    id: 102,
    contentType: "SENTENCE",
    title: "신라면을 끓이며 난로 앞에서 신라 이야기를 나눴다.",
    category: "받침과 유음화",
    difficulty: "INTERMEDIATE",
    learningFocus: "PRONUNCIATION",
    description: "ㄹ·ㄴ 연결 발음과 받침을 집중적으로 연습합니다.",
    scriptText: "신라면을 끓이며 난로 앞에서 신라 이야기를 나눴다.",
    targetPronunciations: ["LIQUID_ASSIMILATION"],
    estimatedSeconds: 50,
    referenceAudioAvailable: true,
  },
  {
    id: 103,
    contentType: "ANNOUNCER",
    title: "가장 중요한 것은 속도가 아니라 방향입니다.",
    category: "아나운서 따라 읽기",
    difficulty: "ADVANCED",
    learningFocus: "INTONATION",
    description: "문장 강조와 끝맺음 억양을 따라 읽습니다.",
    scriptText: "가장 중요한 것은 속도가 아니라 방향입니다.",
    targetPronunciations: ["SENTENCE_STRESS"],
    estimatedSeconds: 40,
    referenceAudioAvailable: true,
  },
  {
    id: 104,
    contentType: "CLASS_PRACTICE",
    title: "발표 첫 문장을 자신감 있게 시작하겠습니다.",
    category: "발음 클래스",
    difficulty: "BEGINNER",
    learningFocus: "BOTH",
    description: "클래스에서 배운 호흡과 발음을 적용합니다.",
    scriptText: "발표 첫 문장을 자신감 있게 시작하겠습니다.",
    targetPronunciations: ["BREATH", "INTONATION"],
    estimatedSeconds: 45,
    referenceAudioAvailable: true,
  },
];

const courseSummaries: CourseSummary[] = [
  {
    id: 201,
    courseType: "PRONUNCIATION",
    title: "받침 발음 기초 클래스",
    difficulty: "BEGINNER",
    estimatedMinutes: 15,
    progressPercent: 25,
  },
  {
    id: 202,
    courseType: "INTONATION",
    title: "전달력을 높이는 억양 클래스",
    difficulty: "INTERMEDIATE",
    estimatedMinutes: 20,
    progressPercent: 0,
  },
];

const courseSteps: Record<string, CourseStep[]> = {
  "201": [
    {
      id: 301,
      stepOrder: 1,
      stepType: "THEORY",
      title: "받침 발음 원리",
      completed: true,
    },
    {
      id: 302,
      stepOrder: 2,
      stepType: "PRACTICE",
      title: "받침 문장 연습",
      practiceContentId: 104,
      completed: false,
    },
  ],
  "202": [
    {
      id: 303,
      stepOrder: 1,
      stepType: "AUDIO_EXAMPLE",
      title: "강조 억양 듣기",
      completed: false,
    },
    {
      id: 304,
      stepOrder: 2,
      stepType: "PRACTICE",
      title: "억양 문장 연습",
      practiceContentId: 103,
      completed: false,
    },
  ],
};

let account: UserAccount = {
  id: "local-dev-user",
  email: "dev@ttobak.local",
  nickname: "개발자",
  status: "ACTIVE",
  loginProviders: ["LOCAL"],
  onboardingCompleted: true,
  createdAt: NOW,
};

let onboarding: OnboardingProfile = {
  currentLevel: "BEGINNER",
  goalText: "개발 환경에서 전체 화면 확인",
  dailyGoalMinutes: 10,
  weeklyGoalCount: 5,
  surveyAnswers: {
    learningPurposes: ["PRESENTATION"],
    improvementAreas: ["PRONUNCIATION", "INTONATION"],
    pronunciationConcerns: ["FINAL_CONSONANT"],
    learningSituations: ["PRESENTATION"],
  },
  completedAt: NOW,
};

const sessions = new Map<string, TrainingSession>();
const recordings = new Map<string, VoiceRecording[]>();
let sessionSequence = 401;
let recordingSequence = 501;

let history: TrainingHistoryItem[] = [
  {
    sessionId: 400,
    contentId: 101,
    contentType: "NEWS",
    title: "오늘의 뉴스 읽기",
    status: "COMPLETED",
    overallScore: 86,
    completedAt: NOW,
  },
  {
    sessionId: 399,
    contentId: 102,
    contentType: "SENTENCE",
    title: "받침과 유음화 연습",
    status: "COMPLETED",
    overallScore: 79,
    completedAt: "2026-08-07T12:00:00.000Z",
  },
];

const analysisResult = (analysisId: Id): AnalysisResult => ({
  id: analysisId,
  status: "COMPLETED",
  transcript: "발표 첫 문장을 자신감 있게 시작하겠습니다.",
  sttConfidence: 0.94,
  overallScore: 84,
  pronunciationScore: 82,
  intonationScore: 86,
  speedWpm: 121,
  speedStatus: "NORMAL",
  stressScore: 85,
  pauseScore: 88,
  strengths: ["말하기 속도가 안정적입니다.", "문장 끝맺음이 자연스럽습니다."],
  weaknesses: ["첫 음절을 조금 더 또렷하게 발음해 보세요."],
  summaryFeedback: "안정적인 발화입니다. 첫 음절에 힘을 주면 더 명확해집니다.",
  analyzedAt: NOW,
});

const segments: AnalysisSegment[] = [
  {
    id: 701,
    sequenceNo: 1,
    expectedText: "발표",
    recognizedText: "발표",
    startMs: 0,
    endMs: 700,
    matchType: "MATCH",
    resultStatus: "NORMAL",
    targetUnit: "발",
    errorType: "NONE",
    pronunciationScore: 91,
    intonationScore: 88,
    feedback: "정확합니다.",
  },
  {
    id: 702,
    sequenceNo: 2,
    expectedText: "첫 문장을",
    recognizedText: "첫 문장을",
    startMs: 700,
    endMs: 1800,
    matchType: "MATCH",
    resultStatus: "CAUTION",
    targetUnit: "첫",
    errorType: "FINAL_CONSONANT",
    pronunciationScore: 76,
    intonationScore: 84,
    feedback: "받침 ㅅ을 짧고 분명하게 닫아 주세요.",
  },
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function paged<T>(items: T[], page = 0, size = 20): PageResult<T> {
  const start = page * size;
  return {
    items: clone(items.slice(start, start + size)),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / Math.max(1, size)),
    hasNext: start + size < items.length,
  };
}

function authSession(): AuthSession {
  saveAccessToken(DEV_TOKEN);
  return {
    accessToken: DEV_TOKEN,
    tokenType: "Bearer",
    expiresIn: 86_400,
    onboardingRequired: false,
    user: {
      id: account.id,
      email: account.email,
      nickname: account.nickname,
      onboardingCompleted: true,
    },
  };
}

function findContent(contentId: Id) {
  return (
    contents.find((item) => String(item.id) === String(contentId)) ??
    contents[0]
  );
}

function findCourse(courseId: Id): CourseDetail {
  const summary =
    courseSummaries.find((item) => String(item.id) === String(courseId)) ??
    courseSummaries[0];
  return {
    ...summary,
    description: `${summary.title}의 개발용 상세 설명입니다.`,
    stepCount: courseSteps[String(summary.id)]?.length ?? 0,
    progress: {
      status: summary.progressPercent > 0 ? "IN_PROGRESS" : "NOT_STARTED",
      progressPercent: summary.progressPercent,
      lastStepId: null,
    },
  };
}

function progress(courseId: Id): CourseProgress {
  const course = findCourse(courseId);
  return {
    courseId: course.id,
    status: course.progressPercent > 0 ? "IN_PROGRESS" : "NOT_STARTED",
    lastStepId: null,
    progressPercent: course.progressPercent,
    startedAt: NOW,
    completedAt: null,
  };
}

function getSession(sessionId: Id): TrainingSession {
  const key = String(sessionId);
  const existing = sessions.get(key);
  if (existing) return existing;
  const fallback: TrainingSession = {
    id: sessionId,
    sessionId,
    contentId: 101,
    learningFocus: "BOTH",
    status: "RECORDING",
    content: {
      id: 101,
      title: contents[0].title,
      scriptText: contents[0].scriptText,
    },
    selectedRecordingId: null,
    recordingCount: 0,
    analysisAvailable: false,
    startedAt: NOW,
  };
  sessions.set(key, fallback);
  return fallback;
}

export function createDevApi(): ApiContract {
  return {
    auth: {
      checkEmail: async (email) => ({
        email,
        available: email !== account.email,
      }),
      signUp: async (input) => {
        account = { ...account, email: input.email, nickname: input.nickname };
        return authSession();
      },
      signIn: async (input) => {
        if (input.email !== "dev@ttobak.local" || input.password !== "Dev1234!")
          throw new ApiError("개발용 계정 정보가 올바르지 않습니다.", 401);
        return authSession();
      },
      socialLogin: async () => ({ ...authSession(), isNewUser: false }),
      refresh: async () => {
        saveAccessToken(DEV_TOKEN);
        return {
          accessToken: DEV_TOKEN,
          tokenType: "Bearer",
          expiresIn: 86_400,
        };
      },
      signOut: async () => clearAccessToken(),
    },
    users: {
      getMe: async () => clone(account),
      updateProfile: async ({ nickname }) => {
        account = { ...account, nickname };
        return { id: account.id, nickname, updatedAt: NOW };
      },
      withdraw: async () => {
        clearAccessToken();
        return { withdrawnAt: NOW };
      },
    },
    onboarding: {
      get: async () => clone(onboarding),
      save: async (input) => {
        onboarding = { ...clone(input), completedAt: NOW };
        return { completed: true, completedAt: NOW };
      },
      update: async (input) => {
        onboarding = { ...onboarding, ...clone(input) };
        return {
          goalText: onboarding.goalText,
          dailyGoalMinutes: onboarding.dailyGoalMinutes,
          updatedAt: NOW,
        };
      },
    },
    home: {
      get: async () => {
        const data: HomeDashboard = {
          today: { completedCount: 1, goalCount: 3, learningSeconds: 480 },
          recommendations: contents.slice(0, 3).map((item) => ({
            contentId: item.id,
            title: item.title,
            contentType: item.contentType,
            reason: "개발 계정 추천 콘텐츠",
          })),
          recentTraining: {
            sessionId: 400,
            contentId: 101,
            title: contents[0].title,
            status: "COMPLETED",
          },
          courseProgress: {
            courseId: 201,
            title: courseSummaries[0].title,
            progressPercent: 25,
          },
        };
        return data;
      },
      getRecommendations: async (filters = {}) =>
        contents
          .filter((item) => !filters.type || item.contentType === filters.type)
          .slice(0, filters.limit ?? 5)
          .map((item) => ({
            contentId: item.id,
            contentType: item.contentType,
            title: item.title,
            difficulty: item.difficulty,
            reason: "개발용 개인화 추천",
          })),
      getRecentTraining: async () => ({
        sessionId: 400,
        contentId: 101,
        contentTitle: contents[0].title,
        status: "COMPLETED",
        resumeType: "RESULT",
        lastUpdatedAt: NOW,
      }),
    },
    content: {
      list: async (filters = {}) => {
        const filtered = contents.filter(
          (item) =>
            (!filters.type || item.contentType === filters.type) &&
            (!filters.category || item.category === filters.category) &&
            (!filters.difficulty || item.difficulty === filters.difficulty) &&
            (!filters.focus || item.learningFocus === filters.focus),
        );
        return paged(filtered, filters.page, filters.size);
      },
      get: async (contentId) => clone(findContent(contentId)),
      getNext: async (filters) =>
        clone(
          contents.find(
            (item) =>
              item.contentType === filters.type &&
              String(item.id) !== String(filters.excludeId ?? ""),
          ) ?? findContent(101),
        ),
      getRecommendations: async (contentId, limit = 5) =>
        contents
          .filter((item) => String(item.id) !== String(contentId))
          .slice(0, limit)
          .map((item) => ({
            id: item.id,
            title: item.title,
            contentType: item.contentType,
            similarityReason: "비슷한 학습 목표",
          })),
      getReferenceAudios: async (contentId) => {
        const data: ReferenceAudio[] = [
          {
            id: `reference-${contentId}`,
            speakerName: "개발용 코치",
            speakerType: "COACH",
            durationMs: 2_000,
            primary: true,
          },
        ];
        return data;
      },
      getReferenceAudioPlaybackUrl: async (audioId) => ({
        audioId,
        playbackUrl: SILENT_WAV,
        expiresAt: NOW,
      }),
    },
    courses: {
      list: async (filters = {}) =>
        paged(
          courseSummaries.filter(
            (item) =>
              (!filters.type || item.courseType === filters.type) &&
              (!filters.difficulty || item.difficulty === filters.difficulty),
          ),
          filters.page,
          filters.size,
        ),
      get: async (courseId) => clone(findCourse(courseId)),
      start: async (courseId) => ({
        ...progress(courseId),
        status: "IN_PROGRESS",
      }),
      getProgress: async (courseId) => progress(courseId),
      updateProgress: async (courseId, input) => ({
        ...progress(courseId),
        status: input.progressPercent >= 100 ? "COMPLETED" : "IN_PROGRESS",
        lastStepId: input.lastStepId,
        progressPercent: input.progressPercent,
      }),
      complete: async (courseId) => ({
        ...progress(courseId),
        status: "COMPLETED",
        progressPercent: 100,
        completedAt: NOW,
      }),
      getSteps: async (courseId) =>
        clone(courseSteps[String(courseId)] ?? courseSteps["201"]),
      getMyProgress: async (status) => {
        const items: UserCourseProgress[] = courseSummaries.map((course) => ({
          ...progress(course.id),
          title: course.title,
          updatedAt: NOW,
        }));
        return status ? items.filter((item) => item.status === status) : items;
      },
    },
    training: {
      create: async (input) => {
        const id = sessionSequence++;
        const content = findContent(input.contentId);
        const session: TrainingSession = {
          id,
          sessionId: id,
          contentId: content.id,
          courseStepId: input.courseStepId,
          learningFocus: input.learningFocus,
          status: "RECORDING",
          content: {
            id: content.id,
            title: content.title,
            scriptText: content.scriptText,
          },
          selectedRecordingId: null,
          recordingCount: 0,
          analysisAvailable: false,
          startedAt: NOW,
        };
        sessions.set(String(id), session);
        recordings.set(String(id), []);
        return clone(session);
      },
      get: async (sessionId) => clone(getSession(sessionId)),
      cancel: async (sessionId) => {
        const session = getSession(sessionId);
        session.status = "CANCELED";
        return { sessionId, status: "CANCELED", canceledAt: NOW };
      },
      getUploadUrl: async (sessionId, input) => ({
        objectKey: `recordings/dev/${sessionId}/${input.fileName}`,
        uploadUrl: "dev-memory://recording",
        expiresAt: NOW,
        requiredHeaders: { "Content-Type": input.mimeType },
      }),
      uploadRecording: async (_upload, _audio, onProgress) => {
        onProgress?.(100);
      },
      registerRecording: async (sessionId, input) => {
        const id = recordingSequence++;
        const recording: VoiceRecording = {
          id,
          recordingId: id,
          attemptNo: (recordings.get(String(sessionId))?.length ?? 0) + 1,
          durationMs: input.durationMs,
          qualityStatus: "PASS",
          selected: false,
          createdAt: NOW,
        };
        const items = recordings.get(String(sessionId)) ?? [];
        items.push(recording);
        recordings.set(String(sessionId), items);
        return clone(recording);
      },
      listRecordings: async (sessionId) =>
        clone(recordings.get(String(sessionId)) ?? []),
      deleteRecording: async (sessionId, recordingId) => {
        recordings.set(
          String(sessionId),
          (recordings.get(String(sessionId)) ?? []).filter(
            (item) => String(item.id) !== String(recordingId),
          ),
        );
      },
      selectRecording: async (sessionId, recordingId) => {
        const items = recordings.get(String(sessionId)) ?? [];
        items.forEach((item) => {
          item.selected = String(item.id) === String(recordingId);
        });
        getSession(sessionId).selectedRecordingId = recordingId;
        return { sessionId, selectedRecordingId: recordingId, selectedAt: NOW };
      },
      analyze: async (sessionId) => {
        const session = getSession(sessionId);
        session.status = "ANALYZING";
        return { analysisId: 601, status: "PROCESSING", requestedAt: NOW };
      },
      getAnalysisStatus: async () => ({
        analysisId: 601,
        status: "COMPLETED",
        stage: "DONE",
        progressPercent: 100,
        failureReason: null,
        updatedAt: NOW,
      }),
      retryAnalysis: async () => ({
        analysisId: 601,
        status: "PROCESSING",
        requestedAt: NOW,
        retryCount: 1,
      }),
      getSessionAnalysis: async (sessionId) => ({
        sessionId,
        analysisId: 601,
        status: "COMPLETED",
        overallScore: 84,
        pronunciationScore: 82,
        intonationScore: 86,
      }),
      getRecordingPlaybackUrl: async (recordingId) => ({
        recordingId,
        playbackUrl: SILENT_WAV,
        expiresAt: NOW,
      }),
      complete: async (sessionId, _totalLearningSeconds) => {
        const session = getSession(sessionId);
        session.status = "COMPLETED";
        const content = findContent(session.contentId ?? 101);
        if (
          !history.some((item) => String(item.sessionId) === String(sessionId))
        ) {
          history = [
            {
              sessionId,
              contentId: content.id,
              contentType: content.contentType,
              title: content.title,
              status: "COMPLETED",
              overallScore: 84,
              completedAt: NOW,
            },
            ...history,
          ];
        }
        return { sessionId, status: "COMPLETED", completedAt: NOW };
      },
    },
    analyses: {
      get: async (analysisId) => analysisResult(analysisId),
      getSegments: async (_analysisId, filters = {}) =>
        paged(segments, filters.page, filters.size),
      regenerateFeedback: async (analysisId) => ({
        analysisId,
        strengths: analysisResult(analysisId).strengths,
        weaknesses: analysisResult(analysisId).weaknesses,
        summaryFeedback: analysisResult(analysisId).summaryFeedback,
        regeneratedAt: NOW,
      }),
    },
    myPage: {
      getStatistics: async () => {
        const data: Statistics = {
          period: { from: "2026-08-01", to: "2026-08-31" },
          totalSessionCount: history.length,
          totalLearningSeconds: 1_560,
          todaySessionCount: 1,
          todayGoalCount: 3,
          consecutiveLearningDays: 2,
          averageOverallScore: 82.5,
          averagePronunciationScore: 81,
          averageIntonationScore: 84,
        };
        return data;
      },
      getScoreTrends: async (metric) => ({
        metric,
        points: [
          { date: "2026-08-07", score: 79, sessionCount: 1 },
          { date: "2026-08-08", score: 86, sessionCount: 1 },
        ],
      }),
      getStrengthsWeaknesses: async () => {
        const data: StrengthsWeaknesses = {
          strengths: [
            {
              targetUnit: "SPEED",
              label: "말하기 속도",
              averageScore: 89,
              attemptCount: 4,
            },
          ],
          weaknesses: [
            {
              targetUnit: "FINAL_CONSONANT",
              label: "받침 발음",
              averageScore: 74,
              attemptCount: 4,
              commonErrorType: "받침 약화",
            },
          ],
          minimumDataSatisfied: true,
        };
        return data;
      },
      listTrainingSessions: async (filters = {}) =>
        paged(
          history.filter(
            (item) =>
              (!filters.type || item.contentType === filters.type) &&
              (!filters.status || item.status === filters.status),
          ),
          filters.page,
          filters.size,
        ),
      getTrainingSession: async (sessionId) => {
        const item =
          history.find(
            (entry) => String(entry.sessionId) === String(sessionId),
          ) ?? history[0];
        const content = findContent(item.contentId);
        const data: TrainingHistoryDetail = {
          session: {
            id: item.sessionId,
            status: item.status,
            startedAt: NOW,
            completedAt: item.completedAt,
            totalLearningSeconds: 480,
          },
          content: {
            id: content.id,
            title: content.title,
            scriptText: content.scriptText,
          },
          recording: { id: 500, durationMs: 8_000, qualityStatus: "PASS" },
          analysis: {
            id: 601,
            transcript: analysisResult(601).transcript,
            overallScore: item.overallScore,
          },
          segments: segments.map((segment) => ({
            sequenceNo: segment.sequenceNo,
            expectedText: segment.expectedText,
            recognizedText: segment.recognizedText,
            startMs: segment.startMs,
            endMs: segment.endMs,
            resultStatus: segment.resultStatus,
          })),
        };
        return data;
      },
      deleteTrainingSession: async (sessionId) => {
        history = history.filter(
          (item) => String(item.sessionId) !== String(sessionId),
        );
      },
      getWeaknessRecommendations: async () => {
        const data: WeaknessRecommendations = {
          weaknesses: [
            {
              targetUnit: "FINAL_CONSONANT",
              label: "받침 발음",
              averageScore: 74,
            },
          ],
          recommendations: [
            {
              targetType: "CONTENT",
              contentId: 102,
              contentType: "SENTENCE",
              title: contents[1].title,
              reason: "받침 발음 보완",
            },
          ],
        };
        return data;
      },
    },
  };
}
