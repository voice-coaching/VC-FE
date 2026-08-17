import assert from "node:assert/strict";
import { createDevApi } from "../src/lib/api/dev";

const api = createDevApi();
let endpointCount = 0;

async function endpoint<T>(request: Promise<T>) {
  const result = await request;
  endpointCount += 1;
  return result;
}

await endpoint(api.auth.checkEmail("new@example.com"));
await endpoint(
  api.auth.signUp({
    email: "new@example.com",
    password: "Password1!",
    nickname: "개발자",
    termsAgreed: true,
    privacyAgreed: true,
  }),
);
await endpoint(
  api.auth.signIn({ email: "dev@ttobak.local", password: "Dev1234!" }),
);
await endpoint(
  api.auth.socialLogin({
    provider: "GOOGLE",
    authorizationCode: "dev-code",
    redirectUri: "http://localhost/auth",
  }),
);
await endpoint(api.auth.refresh());

await endpoint(api.users.getMe());
await endpoint(api.users.updateProfile({ nickname: "개발자" }));

await endpoint(api.onboarding.get());
await endpoint(
  api.onboarding.save({
    currentLevel: "BEGINNER",
    goalText: "개발 검증",
    dailyGoalMinutes: 10,
    weeklyGoalCount: 5,
    surveyAnswers: {
      learningPurposes: ["PRESENTATION"],
      improvementAreas: ["PRONUNCIATION"],
      pronunciationConcerns: [],
      learningSituations: [],
    },
  }),
);
await endpoint(api.onboarding.update({ goalText: "수정된 목표" }));

await endpoint(api.home.get());
await endpoint(api.home.getRecommendations({ type: "SENTENCE", limit: 5 }));
await endpoint(api.home.getRecentTraining());

const contentPage = await endpoint(
  api.content.list({ type: "SENTENCE", page: 0, size: 20 }),
);
assert.ok(contentPage.items.length > 0);
await endpoint(api.content.get(101));
await endpoint(api.content.getNext({ type: "SENTENCE", excludeId: 101 }));
await endpoint(api.content.getReferenceAudios(101));
await endpoint(api.content.getReferenceAudioPlaybackUrl(1));

await endpoint(api.courses.list({ type: "PRONUNCIATION", page: 0, size: 20 }));
await endpoint(api.courses.get(201));
await endpoint(api.courses.start(201));
await endpoint(api.courses.getProgress(201));
await endpoint(
  api.courses.updateProgress(201, { lastStepId: 302, progressPercent: 50 }),
);
await endpoint(api.courses.complete(201));
await endpoint(api.courses.getSteps(201));
await endpoint(api.courses.getMyProgress());

const session = await endpoint(
  api.training.create({ contentId: 101, learningFocus: "BOTH" }),
);
const sessionId = session.sessionId ?? session.id;
assert.ok(sessionId != null);
await endpoint(api.training.get(sessionId));
const upload = await endpoint(
  api.training.getUploadUrl(sessionId, {
    fileName: "recording.webm",
    mimeType: "audio/webm",
    fileSizeBytes: 1,
  }),
);
await api.training.uploadRecording(upload, new Blob(["a"]));
const recording = await endpoint(
  api.training.registerRecording(sessionId, {
    objectKey: upload.objectKey,
    mimeType: "audio/webm",
    fileSizeBytes: 1,
    durationMs: 1_000,
  }),
);
const recordingId = recording.recordingId ?? recording.id;
assert.ok(recordingId != null);
await endpoint(api.training.listRecordings(sessionId));
await endpoint(api.training.selectRecording(sessionId, recordingId));
await endpoint(api.training.analyze(sessionId));
await endpoint(api.training.getAnalysisStatus(sessionId));
await endpoint(api.training.retryAnalysis(sessionId));
await endpoint(api.training.getSessionAnalysis(sessionId));
await endpoint(api.training.getRecordingPlaybackUrl(recordingId));
await endpoint(api.training.complete(sessionId, 10));
await endpoint(api.training.deleteRecording(sessionId, recordingId));
await endpoint(api.training.cancel(sessionId));

await endpoint(api.analyses.get(601));
await endpoint(api.analyses.getSegments(601, { page: 0, size: 100 }));
await endpoint(api.analyses.regenerateFeedback(601, "COACHING"));

await endpoint(api.myPage.getStatistics({ period: "MONTH" }));
await endpoint(api.myPage.getScoreTrends("PRONUNCIATION", "MONTH"));
await endpoint(
  api.myPage.getStrengthsWeaknesses({ period: "MONTH", limit: 5 }),
);
await endpoint(
  api.myPage.listTrainingSessions({
    status: "COMPLETED",
    page: 0,
    size: 20,
  }),
);
await endpoint(api.myPage.getTrainingSession(400));
await endpoint(api.myPage.getWeaknessRecommendations({ limit: 5 }));
await endpoint(api.myPage.deleteTrainingSession(400));

await endpoint(api.auth.signOut());
await endpoint(api.users.withdraw());

assert.equal(endpointCount, 52);
console.log(
  `Development API verification passed: ${endpointCount}/52 endpoints`,
);
