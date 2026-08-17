import assert from "node:assert/strict";
import { createRemoteApi } from "../src/lib/api/remote";

const expected = [
  "GET /api/auth/email-availability?email=test%40example.com",
  "POST /api/auth/signup",
  "POST /api/auth/login",
  "POST /api/auth/social-login",
  "POST /api/auth/token/refresh",
  "POST /api/auth/logout",
  "GET /api/users/me",
  "PATCH /api/users/me",
  "DELETE /api/users/me",
  "GET /api/onboarding/me",
  "PUT /api/onboarding/me",
  "PATCH /api/onboarding/me",
  "GET /api/home",
  "GET /api/recommendations?type=SENTENCE&limit=5",
  "GET /api/users/me/training-sessions/recent",
  "GET /api/practice-contents?type=SENTENCE&page=0&size=20",
  "GET /api/practice-contents/next?type=SENTENCE&excludeId=1",
  "GET /api/practice-contents/1",
  "GET /api/practice-contents/1/reference-audios",
  "GET /api/reference-audios/1/playback-url",
  "GET /api/courses?type=PRONUNCIATION&page=0&size=20",
  "GET /api/courses/1",
  "POST /api/courses/1/start",
  "GET /api/courses/1/progress",
  "PATCH /api/courses/1/progress",
  "POST /api/courses/1/complete",
  "GET /api/courses/1/steps",
  "GET /api/users/me/course-progress?status=IN_PROGRESS",
  "POST /api/training-sessions",
  "GET /api/training-sessions/1",
  "POST /api/training-sessions/1/cancel",
  "POST /api/training-sessions/1/recordings/upload-url",
  "POST /api/training-sessions/1/recordings",
  "GET /api/training-sessions/1/recordings",
  "DELETE /api/training-sessions/1/recordings/1",
  "PATCH /api/training-sessions/1/recordings/1/select",
  "POST /api/training-sessions/1/analyze",
  "GET /api/training-sessions/1/analysis/status",
  "POST /api/training-sessions/1/analysis/retry",
  "GET /api/training-sessions/1/analysis",
  "GET /api/recordings/1/playback-url",
  "POST /api/training-sessions/1/complete",
  "GET /api/analyses/1",
  "GET /api/analyses/1/segments?page=0&size=100",
  "POST /api/analyses/1/feedback/regenerate",
  "GET /api/users/me/statistics?period=MONTH",
  "GET /api/users/me/score-trends?metric=PRONUNCIATION&period=MONTH",
  "GET /api/users/me/strengths-weaknesses?period=MONTH&limit=5",
  "GET /api/users/me/training-sessions?type=SENTENCE&status=COMPLETED&page=0&size=20",
  "GET /api/users/me/training-sessions/1",
  "DELETE /api/users/me/training-sessions/1",
  "GET /api/users/me/weakness-recommendations?limit=10&contentType=SENTENCE",
] as const;

const calls: string[] = [];
const requestOptions: RequestInit[] = [];
const responseData = {
  accessToken: "test-token",
  tokenType: "Bearer",
  expiresIn: 600,
  userId: 1,
  id: 1,
  sessionId: 1,
  analysisId: 1,
  email: "test@example.com",
  nickname: "tester",
  onboardingRequired: false,
  isNewUser: false,
  user: { id: 1, nickname: "tester", onboardingCompleted: true },
  items: [],
};

globalThis.fetch = (async (
  input: string | URL | Request,
  init?: RequestInit,
) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input
        : input.url,
  );
  calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
  requestOptions.push(init ?? {});
  return new Response(
    JSON.stringify({ result: true, message: "ok", data: responseData }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}) as typeof fetch;

const api = createRemoteApi("http://127.0.0.1:9999");

await api.auth.checkEmail("test@example.com");
await api.auth.signUp({
  email: "test@example.com",
  password: "Password1!",
  nickname: "tester",
  termsAgreed: true,
  privacyAgreed: true,
});
await api.auth.signIn({ email: "test@example.com", password: "Password1!" });
await api.auth.socialLogin({
  provider: "GOOGLE",
  authorizationCode: "code",
  redirectUri: "http://localhost/auth",
});
await api.auth.refresh();
await api.auth.signOut();
await api.users.getMe();
await api.users.updateProfile({ nickname: "tester" });
await api.users.withdraw();
await api.onboarding.get();
await api.onboarding.save({
  currentLevel: "BEGINNER",
  goalText: "goal",
  dailyGoalMinutes: 10,
  weeklyGoalCount: 5,
  surveyAnswers: {
    learningPurposes: [],
    improvementAreas: [],
    pronunciationConcerns: [],
    learningSituations: [],
  },
});
await api.onboarding.update({ goalText: "goal" });
await api.home.get();
await api.home.getRecommendations({ type: "SENTENCE", limit: 5 });
await api.home.getRecentTraining();
await api.content.list({ type: "SENTENCE", page: 0, size: 20 });
await api.content.getNext({ type: "SENTENCE", excludeId: 1 });
await api.content.get(1);
await api.content.getReferenceAudios(1);
await api.content.getReferenceAudioPlaybackUrl(1);
await api.courses.list({ type: "PRONUNCIATION", page: 0, size: 20 });
await api.courses.get(1);
await api.courses.start(1);
await api.courses.getProgress(1);
await api.courses.updateProgress(1, { lastStepId: 1, progressPercent: 50 });
await api.courses.complete(1);
await api.courses.getSteps(1);
await api.courses.getMyProgress("IN_PROGRESS");
await api.training.create({ contentId: 1, learningFocus: "PRONUNCIATION" });
await api.training.get(1);
await api.training.cancel(1);
await api.training.getUploadUrl(1, {
  fileName: "recording.webm",
  mimeType: "audio/webm",
  fileSizeBytes: 1,
});
await api.training.registerRecording(1, {
  objectKey: "key",
  mimeType: "audio/webm",
  fileSizeBytes: 1,
  durationMs: 1000,
});
await api.training.listRecordings(1);
await api.training.deleteRecording(1, 1);
await api.training.selectRecording(1, 1);
await api.training.analyze(1);
await api.training.getAnalysisStatus(1);
await api.training.retryAnalysis(1);
await api.training.getSessionAnalysis(1);
await api.training.getRecordingPlaybackUrl(1);
await api.training.complete(1, 60);
await api.analyses.get(1);
await api.analyses.getSegments(1, { page: 0, size: 100 });
await api.analyses.regenerateFeedback(1, "COACHING");
await api.myPage.getStatistics({ period: "MONTH" });
await api.myPage.getScoreTrends("PRONUNCIATION", "MONTH");
await api.myPage.getStrengthsWeaknesses({ period: "MONTH", limit: 5 });
await api.myPage.listTrainingSessions({
  type: "SENTENCE",
  status: "COMPLETED",
  page: 0,
  size: 20,
});
await api.myPage.getTrainingSession(1);
await api.myPage.deleteTrainingSession(1);
await api.myPage.getWeaknessRecommendations({
  limit: 10,
  contentType: "SENTENCE",
});

assert.equal(
  expected.length,
  52,
  "운영 Swagger 엔드포인트 수가 52개여야 합니다.",
);
assert.deepEqual([...new Set(calls)].sort(), [...expected].sort());
assert.ok(requestOptions.every((init) => init.credentials === "include"));
assert.ok(
  requestOptions.every(
    (init) => new Headers(init.headers).get("accept") === "application/json",
  ),
);
assert.ok(
  requestOptions.every(
    (init) =>
      !("skipAuth" in init) &&
      !("skipRefresh" in init) &&
      !("timeoutMs" in init),
  ),
  "Client-only request options must not leak into fetch",
);

let protectedRequestCount = 0;
const refreshCalls: string[] = [];
globalThis.fetch = (async (
  input: string | URL | Request,
  init?: RequestInit,
) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input
        : input.url,
  );
  refreshCalls.push(`${init?.method ?? "GET"} ${url.pathname}`);

  if (url.pathname === "/api/users/me" && protectedRequestCount++ === 0) {
    return new Response(
      JSON.stringify({ result: false, message: "expired", data: null }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ result: true, message: "ok", data: responseData }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}) as typeof fetch;

await api.users.getMe();
assert.deepEqual(refreshCalls, [
  "GET /api/users/me",
  "POST /api/auth/token/refresh",
  "GET /api/users/me",
]);

console.log(
  `API contract verification passed: ${expected.length}/${expected.length} Swagger endpoints + token refresh retry`,
);
