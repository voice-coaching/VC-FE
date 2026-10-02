import assert from "node:assert/strict";
import { ApiError } from "../src/lib/api/client";
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
  "GET /api/users/me/profile-image",
  "POST /api/users/me/profile-image",
  "PUT /api/users/me/profile-image",
  "DELETE /api/users/me/profile-image",
  "GET /api/users/me/title",
  "POST /api/users/me/title-exams",
  "GET /api/users/me/title-exams/1",
  "POST /api/users/me/title-exams/1/submit",
  "DELETE /api/users/me",
  "GET /api/onboarding/me",
  "PUT /api/onboarding/me",
  "PATCH /api/onboarding/me",
  "GET /api/home",
  "GET /api/recommendations?type=SENTENCE&limit=5",
  "GET /api/users/me/training-sessions/recent",
  "GET /api/practice-contents?type=SENTENCE&page=0&size=20",
  "POST /api/practice-contents/custom",
  "GET /api/practice-contents/facets?type=NEWS",
  "GET /api/practice-contents/1/adjacent?type=NEWS&category=ECONOMY&difficulty=BEGINNER&focus=PRONUNCIATION",
  "GET /api/practice-contents/next?type=SENTENCE&excludeId=1",
  "GET /api/practice-contents/1",
  "GET /api/practice-contents/1/recommendations?limit=5",
  "GET /api/practice-contents/1/reference-audios",
  "GET /api/reference-audios/1/playback-url",
  "GET /api/courses/1/steps/1/practice-examples?sessionId=1",
  "GET /api/practice-examples/example-1/audio",
  "GET /api/courses?type=PRONUNCIATION&page=0&size=20",
  "GET /api/courses/1",
  "POST /api/courses/1/start",
  "GET /api/courses/1/progress",
  "PATCH /api/courses/1/progress",
  "POST /api/courses/1/complete",
  "GET /api/courses/1/steps",
  "GET /api/courses/1/steps/1?sessionId=1",
  "GET /api/users/me/course-progress?status=IN_PROGRESS",
  "GET /api/analysis-capabilities",
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
  "GET /api/users/me/notification-preferences",
  "PATCH /api/users/me/notification-preferences",
  "POST /api/users/me/push-subscriptions",
  "DELETE /api/users/me/push-subscriptions/1",
  "GET /api/notifications?page=0&size=20&unreadOnly=true",
  "PATCH /api/notifications/1/read",
  "POST /api/notifications/read-all",
  "GET /api/notices?page=0&size=20",
  "GET /api/notices/1",
  "POST /api/inquiries",
  "GET /api/users/me/inquiries?page=0&size=20",
  "GET /api/users/me/inquiries/1",
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
  if (url.pathname.endsWith("/audio")) {
    return new Response(new Uint8Array([1]), {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    });
  }
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
  redirectUri: "http://localhost:3000/oauth/google/callback",
  state: "native.test-state",
});
assert.deepEqual(JSON.parse(String(requestOptions.at(-1)?.body)), {
  provider: "GOOGLE",
  authorizationCode: "code",
  redirectUri: "http://localhost:3000/oauth/google/callback",
  state: "native.test-state",
});
assert.equal(
  new Headers(requestOptions.at(-1)?.headers).has("authorization"),
  false,
  "OAuth code exchange must not send an existing access token",
);
await api.auth.refresh();
await api.auth.signOut();
await api.users.getMe();
await api.users.updateProfile({ nickname: "tester" });
await api.users.getProfileImage();
const profileImage = {
  file: new Blob(["profile"], { type: "image/png" }),
  fileName: "profile.png",
};
await api.users.createProfileImage(profileImage, "profile-image-key");
await api.users.updateProfileImage(profileImage);
await api.users.deleteProfileImage();
await api.users.getTitle();
await api.users.createTitleExam("title-exam-key");
await api.users.getTitleExam(1);
await api.users.submitTitleExam(1, 1);
await api.users.withdraw();
await api.onboarding.get();
await api.onboarding.save({
  currentLevel: "BEGINNER",
  goalText: "goal",
  dailyGoalMinutes: 10,
  weeklyGoalCount: 5,
  surveyAnswers: {
    learningPurposes: ["PRESENTATION"],
    improvementAreas: ["발음"],
    pronunciationConcerns: ["받침"],
    learningSituations: ["발표"],
  },
});
await api.onboarding.update({ goalText: "goal" });
await api.home.get();
await api.home.getRecommendations({ type: "SENTENCE", limit: 5 });
await api.home.getRecentTraining();
await api.content.list({ type: "SENTENCE", page: 0, size: 20 });
await api.content.createCustom(
  {
    title: "내 문장",
    scriptText: "또박또박 읽습니다.",
    learningFocus: "PRONUNCIATION",
    retention: "SESSION_HISTORY",
    locale: "ko-KR",
  },
  "custom-content-key",
);
await api.content.getFacets("NEWS");
await api.content.getAdjacent(1, {
  type: "NEWS",
  category: "ECONOMY",
  difficulty: "BEGINNER",
  focus: "PRONUNCIATION",
});
await api.content.getNext({ type: "SENTENCE", excludeId: 1 });
await api.content.get(1);
await api.content.getRecommendations(1, 5);
await api.content.getReferenceAudios(1);
await api.content.getReferenceAudioPlaybackUrl(1);
await api.examples.list(1, 1, 1);
await api.examples.getAudio("example-1");
await api.courses.list({ type: "PRONUNCIATION", page: 0, size: 20 });
await api.courses.get(1);
await api.courses.start(1);
await api.courses.getProgress(1);
await api.courses.updateProgress(1, { lastStepId: 1, progressPercent: 50 });
await api.courses.complete(1);
await api.courses.getSteps(1);
await api.courses.getStep(1, 1, 1);
await api.courses.getMyProgress("IN_PROGRESS");
await api.training.getAnalysisCapabilities();
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
  mimeType: "video/webm",
  fileSizeBytes: 1,
  durationMs: 1000,
  videoProcessingConsentAccepted: true,
  videoProcessingConsentPolicyRevision: "voice-video-processing-consent-v1",
});
await api.training.listRecordings(1);
await api.training.deleteRecording(1, 1);
await api.training.selectRecording(1, 1);
const analysisConsent = {
  accepted: true as const,
  policyRevision: "voice-processing-consent-v1",
};
await api.training.analyze(1, analysisConsent);
await api.training.getAnalysisStatus(1);
await api.training.retryAnalysis(1, analysisConsent);
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
await api.notifications.getPreferences();
await api.notifications.updatePreferences({
  practiceReminder: { enabled: true },
});
await api.notifications.createPushSubscription(
  {
    endpoint: "https://push.example/subscription",
    keys: { p256dh: "p256dh", auth: "auth" },
    userAgent: "contract-test",
    deviceName: "test-device",
  },
  "push-subscription-key",
);
await api.notifications.deletePushSubscription(1);
await api.notifications.list({ page: 0, size: 20, unreadOnly: true });
await api.notifications.markRead(1);
await api.notifications.markAllRead();
await api.support.listNotices({ page: 0, size: 20 });
await api.support.getNotice(1);
await api.support.createInquiry(
  {
    category: "SERVICE",
    subject: "문의 제목",
    body: "문의 내용",
    replyEmail: "test@example.com",
  },
  "inquiry-key",
);
await api.support.listInquiries({ page: 0, size: 20 });
await api.support.getInquiry(1);

assert.equal(
  expected.length,
  80,
  "Frontend adapter must cover every endpoint in the updated API contract.",
);
assert.deepEqual([...new Set(calls)].sort(), [...expected].sort());
for (const [path, key] of [
  ["POST /api/users/me/profile-image", "profile-image-key"],
  ["POST /api/users/me/title-exams", "title-exam-key"],
  ["POST /api/practice-contents/custom", "custom-content-key"],
  ["POST /api/users/me/push-subscriptions", "push-subscription-key"],
  ["POST /api/inquiries", "inquiry-key"],
] as const) {
  const callIndex = calls.indexOf(path);
  assert.equal(
    new Headers(requestOptions[callIndex]?.headers).get("idempotency-key"),
    key,
  );
}
for (const path of [
  "POST /api/training-sessions/1/analyze",
  "POST /api/training-sessions/1/analysis/retry",
]) {
  const callIndex = calls.indexOf(path);
  assert.notEqual(callIndex, -1);
  assert.deepEqual(
    JSON.parse(String(requestOptions[callIndex]?.body)),
    analysisConsent,
  );
}
const recordingIndex = calls.indexOf(
  "POST /api/training-sessions/1/recordings",
);
assert.deepEqual(JSON.parse(String(requestOptions[recordingIndex]?.body)), {
  objectKey: "key",
  mimeType: "video/webm",
  fileSizeBytes: 1,
  durationMs: 1000,
  videoProcessingConsentAccepted: true,
  videoProcessingConsentPolicyRevision: "voice-video-processing-consent-v1",
});
const regenerateIndex = calls.indexOf(
  "POST /api/analyses/1/feedback/regenerate",
);
assert.deepEqual(JSON.parse(String(requestOptions[regenerateIndex]?.body)), {
  feedbackStyle: "COACHING",
});
assert.ok(requestOptions.every((init) => init.credentials === "include"));
assert.ok(
  requestOptions.every((init, index) =>
    calls[index] === "GET /api/practice-examples/example-1/audio"
      ? new Headers(init.headers).get("accept") === "audio/mpeg"
      : new Headers(init.headers).get("accept") === "application/json",
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
  `API contract verification passed: ${expected.length}/${expected.length} endpoints + token refresh retry`,
);

// Fixtures mirror VC-BE Onboarding*ResponseDto and ApiResponse, not a generic
// object with unrelated fields. The PATCH response is deliberately incomplete.
const onboardingDetail = {
  currentLevel: "BEGINNER",
  goalText: null,
  dailyGoalMinutes: null,
  weeklyGoalCount: null,
  surveyAnswers: {
    learningPurposes: ["PRESENTATION"],
    improvementAreas: ["발음"],
    pronunciationConcerns: ["받침"],
    learningSituations: ["발표"],
  },
  completedAt: "2026-09-07T16:00:00+09:00",
};
const completion = {
  completed: true,
  completedAt: onboardingDetail.completedAt,
};
const patchResponse = {
  goalText: "발표 연습",
  dailyGoalMinutes: null,
  updatedAt: onboardingDetail.completedAt,
};
const onboardingCalls: Array<{ method: string; body: unknown }> = [];
globalThis.fetch = (async (_input, init) => {
  const method = init?.method ?? "GET";
  onboardingCalls.push({
    method,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  });
  const data =
    method === "PUT"
      ? completion
      : method === "PATCH"
        ? patchResponse
        : onboardingDetail;
  return Response.json({ result: true, message: "성공", data });
}) as typeof fetch;
assert.deepEqual(await api.onboarding.get(), onboardingDetail);
assert.deepEqual(
  await api.onboarding.save({
    currentLevel: "BEGINNER",
    surveyAnswers: onboardingDetail.surveyAnswers,
  }),
  completion,
);
const partialUpdate = {
  goalText: "발표 연습",
  surveyAnswers: { improvementAreas: ["억양"] },
};
assert.deepEqual(await api.onboarding.update(partialUpdate), patchResponse);
assert.deepEqual(onboardingCalls[2], { method: "PATCH", body: partialUpdate });
assert.deepEqual(onboardingCalls[1].body, {
  currentLevel: "BEGINNER",
  surveyAnswers: onboardingDetail.surveyAnswers,
});
for (const status of [400, 404]) {
  globalThis.fetch = (async () =>
    Response.json(
      { result: false, message: "온보딩 오류", data: null },
      { status },
    )) as typeof fetch;
  await assert.rejects(
    api.onboarding.get(),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === status &&
      error.message === "온보딩 오류",
  );
}
console.log(
  "VC-BE onboarding DTO verification passed: nullable GET, PUT, nested PATCH, 400/404 envelopes",
);
