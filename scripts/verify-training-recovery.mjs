import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.PRACTICE_TEST_BASE_URL ?? "http://127.0.0.1:3135";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Local fixtures only");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PRACTICE_BROWSER_EXECUTABLE_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const text = "오늘의 소식을 전합니다.";
try {
  for (const scenario of ["lost-put", "lost-analysis", "head-503"]) {
    const context = await browser.newContext({
      viewport: { width: 400, height: 811 },
    });
    await context.addInitScript(() =>
      localStorage.setItem("speakai.access-token", "local-fixture"),
    );
    let uploaded = scenario === "lost-analysis",
      registered = scenario === "lost-analysis",
      analyzed = false;
    let unavailable = scenario === "head-503";
    const counts = {
      put: 0,
      register: 0,
      analyze: 0,
      create: 0,
      cancel: 0,
      recovery: 0,
    };
    const page = await context.newPage();
    await context.route("**/fixture-storage", async (route) => {
      counts.put++;
      uploaded = true;
      if (scenario === "lost-put" && counts.put === 1)
        return route.abort("connectionreset");
      return route.fulfill({ status: 200 });
    });
    await context.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace("/api/backend", "");
      const reply = (data, status = 200, code) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(
            status === 200
              ? { result: true, data }
              : { result: false, code, message: "fixture unavailable" },
          ),
        });
      if (path === "/api/users/me")
        return reply({
          id: 1,
          role: "USER",
          onboardingCompleted: true,
          nickname: "fixture",
        });
      if (path === "/api/practice-contents/183")
        return reply({
          id: 183,
          contentType: "SENTENCE",
          title: "복구 문장",
          scriptText: text,
          learningFocus: "PRONUNCIATION",
          referenceAudioAvailable: false,
        });
      if (path === "/api/analysis-capabilities/canonical")
        return reply({
          capabilityVersion: "voice-coaching.analysis-capabilities.v1",
          analysisProfile: "CANONICAL_AUDIOVISUAL_20261007_V6",
          resultSchemas: ["voice-coaching.runpod-analysis-result.v6"],
          admissionEnabled: !(scenario === "lost-analysis" && analyzed),
          scopes: Object.fromEntries(
            ["STANDALONE_AUDIO", "COURSE", "TITLE_EXAM", "VIDEO"].map((key) => [
              key,
              { supported: true, reasonCode: null },
            ]),
          ),
        });
      if (path === "/api/analysis-capabilities")
        return reply({
          recordingUpload: "CONFIGURED",
          analysisRequests: "CONFIGURED",
          supportedLearningFocuses: ["PRONUNCIATION"],
          acceptedAudioMimeTypes: ["audio/wav"],
          minimumDurationMs: 500,
          maximumDurationMs: 90000,
          maximumAudioUploadBytes: 1000000,
          voiceProcessingConsentRequired: false,
        });
      if (path.endsWith("/recovery")) {
        counts.recovery++;
        if (unavailable)
          return reply(null, 503, "ANALYSIS_INTEGRATION_UNAVAILABLE");
        return reply({
          sessionId: 77,
          status: analyzed ? "ANALYZING" : "UPLOADING",
          selectedRecordingId: registered ? 55 : null,
          analysis: analyzed
            ? {
                analysisId: 88,
                status: "PROCESSING",
                stage: "ANALYZING",
                progressPercent: 20,
                failureReason: null,
                updatedAt: "2026-11-08T10:00:00Z",
                deadlineAt: null,
                serverTime: "2026-11-08T10:00:00Z",
                resultAvailable: false,
              }
            : null,
          uploads: [
            {
              uploadIntentId: 1,
              objectKey: "fixture.wav",
              mimeType: "audio/wav",
              fileSizeBytes: 20,
              status: registered
                ? "REGISTERED"
                : uploaded
                  ? "READY_TO_REGISTER"
                  : "UPLOAD_REQUIRED",
              recordingId: registered ? 55 : null,
              expiresAt: "2099-01-01T00:00:00Z",
            },
          ],
          hasMoreUploads: false,
          serverTime: "2026-11-08T10:00:00Z",
        });
      }
      if (path.endsWith("/recordings/upload-url")) {
        assert.equal(request.headers()["idempotency-key"], "upload-key");
        return reply({
          objectKey: "fixture.wav",
          uploadUrl: `${base}/fixture-storage`,
          expiresAt: "2099-01-01T00:00:00Z",
        });
      }
      if (path.endsWith("/recordings") && request.method() === "POST") {
        assert.equal(request.headers()["idempotency-key"], "registration-key");
        counts.register++;
        registered = true;
        return reply({ recordingId: 55 });
      }
      if (path.endsWith("/recordings"))
        return reply({
          items: registered
            ? [
                {
                  id: 55,
                  recordingId: 55,
                  qualityStatus: "PASS",
                  selected: true,
                  attemptNo: 1,
                  durationMs: 7000,
                },
              ]
            : [],
        });
      if (path.endsWith("/analyze")) {
        assert.equal(request.headers()["idempotency-key"], "analysis-key");
        counts.analyze++;
        analyzed = true;
        if (scenario === "lost-analysis" && counts.analyze === 1)
          return route.abort("connectionreset");
        return reply({ analysisId: 88, status: "PENDING" });
      }
      if (path.endsWith("/analysis/status"))
        return reply({
          analysisId: 88,
          status: "PROCESSING",
          stage: "ANALYZING",
          progressPercent: 20,
        });
      if (path === "/api/training-sessions/77")
        return reply({
          id: 77,
          status: analyzed ? "ANALYZING" : "UPLOADING",
          selectedRecordingId: registered ? 55 : null,
          analysisAvailable: analyzed,
          content: { id: 183 },
        });
      if (path === "/api/training-sessions") counts.create++;
      if (path.endsWith("/cancel")) counts.cancel++;
      return reply({ items: [], totalElements: 0 });
    });
    await page.goto(`${base}/login`);
    // Seed an interrupted capture, then exercise the real component, adapter and IndexedDB on reload.
    await page.evaluate(
      async ({ text, registered }) => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open("speakai-practice-recovery-v1", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("attempts");
          req.onsuccess = () => resolve(req.result);
          req.onerror = reject;
        });
        const context = JSON.stringify({
          contentId: 183,
          scriptText: text,
          courseStepId: null,
          titleExamId: null,
          focus: "PRONUNCIATION",
        });
        const scope = `recording:fixture`;
        const blob = new Blob(["exact retained bytes"], { type: "audio/wav" });
        const record = {
          version: 1,
          resultSchema: "voice-coaching.runpod-analysis-result.v6",
          userId: "1",
          scope,
          context,
          attemptId: "fixture",
          sessionId: 77,
          recordingId: registered ? 55 : undefined,
          sessionInput: {
            contentId: 183,
            courseStepId: null,
            titleExamId: null,
            learningFocus: "PRONUNCIATION",
          },
          source: {
            blob,
            original: blob,
            durationMs: 7000,
            mimeType: "audio/wav",
            extension: "wav",
          },
          keys: {
            session: "session-key",
            upload: "upload-key",
            registration: "registration-key",
            analysis: "analysis-key",
          },
          objectKey: "fixture.wav",
          uploadInput: {
            fileName: "fixture.wav",
            mimeType: "audio/wav",
            fileSizeBytes: 20,
          },
        };
        await new Promise((resolve, reject) => {
          const tx = db.transaction("attempts", "readwrite");
          tx.objectStore("attempts").put(record, JSON.stringify(["1", scope]));
          tx.oncomplete = resolve;
          tx.onerror = reject;
        });
        db.close();
      },
      { text, registered },
    );
    await page.goto(
      `${base}/practice/183?sessionId=77&recordingAttempt=fixture&start=1`,
    );
    if (scenario === "lost-put") {
      await page.waitForFunction(
        () =>
          document.body.innerText.includes("업로드") &&
          document.body.innerText.includes("다시"),
      );
      await page.reload();
    } else if (scenario === "lost-analysis") {
      await page.waitForFunction(() =>
        document.body.innerText.includes("다시"),
      );
      await page.reload();
    } else {
      await page.waitForFunction(() =>
        document.body.innerText.includes("fixture unavailable"),
      );
      assert.equal(counts.put, 0);
      assert.equal(counts.register, 0);
      assert.equal(counts.analyze, 0);
      unavailable = false;
      await context.setOffline(true);
      await context.setOffline(false);
    }
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("분석") &&
        !document.body.innerText.includes("fixture unavailable"),
    );
    await new Promise((resolve, reject) => {
      const until = Date.now() + 15000;
      const timer = setInterval(() => {
        if (analyzed) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() > until) {
          clearInterval(timer);
          reject(new Error("analysis was not recovered"));
        }
      }, 50);
    });
    await page.reload();
    await page.waitForFunction(() => document.body.innerText.includes("분석"));
    assert.equal(counts.analyze, 1);
    assert.equal(counts.create, 0);
    assert.equal(counts.cancel, 0);
    assert.equal(counts.put, scenario === "lost-analysis" ? 0 : 1);
    assert.equal(counts.register, scenario === "lost-analysis" ? 0 : 1);
    console.log(`PASS ${scenario}`, counts);
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 400, height: 811 },
  });
  await context.addInitScript(() =>
    localStorage.setItem("speakai.access-token", "local-fixture"),
  );
  let aiReads = 0,
    aiCreates = 0,
    sessionCreates = 0;
  await context.route("**/api/backend/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const reply = (data) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ result: true, data }),
      });
    if (path.endsWith("/api/users/me"))
      return reply({ id: 1, onboardingCompleted: true, role: "USER" });
    if (path.endsWith("/video-analysis-upload-grants")) {
      const input = request.postDataJSON();
      assert.equal(
        input.clientRequestId,
        "00000000-0000-4000-8000-000000000003",
      );
      return reply({
        schemaVersion: "voice-coaching.browser-video-grant.v1",
        aiBaseUrl: "https://ai.invalid",
        jobsPath: "/browser/v1/video-analysis-jobs",
        grantToken: "fixture-only",
        expiresAt: Math.floor(Date.now() / 1000) + 300,
        metadata: {
          clientRequestId: input.clientRequestId,
          contentId: 183,
          scriptText: "한국은행이 기준금리를 연 3.5퍼센트로 동결했습니다.",
          source: input.source,
        },
      });
    }
    if (request.method() === "POST" && path.endsWith("/training-sessions"))
      sessionCreates++;
    return reply({ items: [] });
  });
  await context.route("https://ai.invalid/**", async (route) => {
    if (route.request().method() === "POST") aiCreates++;
    else aiReads++;
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: "{}",
    });
  });
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("speakai-practice-recovery-v1", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("attempts");
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
    const scriptText = "한국은행이 기준금리를 연 3.5퍼센트로 동결했습니다.";
    const record = {
      version: 1,
      clientRequestId: "00000000-0000-4000-8000-000000000003",
      sessionKey: "video-session-key",
      sessionId: 77,
      contentId: 183,
      scriptText,
      title: "입 모양 연습 1",
      clip: {
        blob: new Blob(["retained-video-bytes"], { type: "video/webm" }),
        promptIndex: 0,
        durationMs: 7000,
        hasAudioTrack: true,
      },
      job: {
        jobId: "00000000-0000-4000-8000-000000000001",
        executionId: "00000000-0000-4000-8000-000000000002",
        sequence: 9,
      },
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction("attempts", "readwrite");
      tx.objectStore("attempts").put(
        record,
        JSON.stringify(["1", `video:fixture:${scriptText}`]),
      );
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  });
  await page.goto(`${base}/lip-practice?videoAttempt=fixture`);
  await page.getByText("촬영 완료", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("촬영 완료", { exact: true }).waitFor();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "AI 발음 분석하기", exact: true })
    .click();
  await page
    .getByText("영상 발음 분석을 완료하지 못했어요", { exact: true })
    .waitFor();
  assert.equal(aiReads, 1);
  assert.equal(aiCreates, 0);
  assert.equal(sessionCreates, 0);
  console.log(
    "PASS restored video retains its known job on 404 without fresh inference",
  );
  await context.close();
} finally {
  await browser.close();
}
