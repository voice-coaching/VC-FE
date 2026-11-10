import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.HISTORY_TEST_BASE_URL ?? "http://127.0.0.1:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Local fixtures only");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.HISTORY_BROWSER_EXECUTABLE_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const rows = [319, 292, 287, 279, 260, 259, 258, 197].map((sessionId, i) => ({
  sessionId,
  contentId: i === 1 ? 312 : 312 + i,
  contentType: "SENTENCE",
  title: `완료 기록 ${sessionId}`,
  status: "COMPLETED",
  overallScore: i === 2 ? null : 27.2,
  completedAt: "2026-11-10T09:00:00Z",
}));
const score = {
  overallScore: null,
  validity: "NOT_CALIBRATED",
  reason: "NO_APPROVED_SCORING_CONTRACT",
};
const feedbackResult = {
  decision: { status: "ACCEPT", reason_code: null, stage: null },
  score,
  coaching: {
    generationStatus: "SCHEMA_AND_STRUCTURAL_SEMANTICS_VALID",
    feedback: "문구만 있는 정상 피드백",
    items: [],
  },
  failure: null,
  sourceIdentity: {
    requestId: "00000000-0000-4000-8000-000000000001",
    executionId: "00000000-0000-4000-8000-000000000002",
    audioSha256: "a".repeat(64),
    scriptSha256: "b".repeat(64),
    coreManifestSha256: "c".repeat(64),
    harnessManifestSha256: "d".repeat(64),
  },
};
const candidate = {
  candidateId: "a".repeat(64) + ":candidate-0",
  evidenceIds: [],
  expectedPhone: "k",
  observedCandidate: "t",
  expectedRole: "onset",
  roleSemantics: "FROZEN_G2P_EXPECTED_PHONE_ROLE",
  repetitionCount: 1,
  claimScope: "MODEL_OBSERVATION_NOT_CONFIRMED_ARTICULATION",
  disposition: "PRONUNCIATION_REVIEW",
  presentationState: "CLEAR_CONTRAST",
  facts: [],
  guidance: {
    guidanceId: "practice",
    revision: "basic-practice-v1",
    scope: "GENERAL_TARGET_PRACTICE_NOT_PERSONAL_CAUSE",
    action: "천천히",
    practice: "반복",
    selfCheck: "확인",
  },
};
const itemResult = structuredClone(feedbackResult);
delete itemResult.coaching.feedback;
itemResult.coaching.items.push({
  candidate,
  expression: {
    explanation: "관측",
    action: "교정 연습",
    practice: "반복",
    selfCheck: "확인",
  },
});
const direct = [
  feedbackResult,
  itemResult,
  {
    ...feedbackResult,
    decision: {
      status: "SYSTEM_FAILURE",
      reason_code: "SYSTEM_ANALYSIS_FAILURE",
      stage: "alignment",
    },
    failure: "CANONICAL_ANALYSIS_FAILED",
    coaching: { generationStatus: "NOT_DISPATCHED", items: [] },
  },
].map((result, i) => ({
  jobId: `00000000-0000-4000-8000-00000000000${i + 3}`,
  scriptText: ["문구 리포트", "교정 항목 리포트", "실패 리포트"][i],
  result,
  storageStatus: "SAVED",
}));
try {
  for (const scenario of [
    "list",
    "classification-failure",
    "empty",
    "direct",
    "detail-retry",
    "pagination",
  ]) {
    const context = await browser.newContext({
      viewport: { width: 400, height: 850 },
    });
    await context.addInitScript(() => {
      localStorage.setItem("speakai.access-token", "history-fixture");
      localStorage.setItem("ttobak.terms.accepted.9", "{}");
    });
    const calls = [];
    const counts = new Map();
    let detailReads = 0;
    let metadataFailed = scenario === "classification-failure";
    await context.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace("/api/backend", "");
      calls.push(path);
      const ok = (data) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ result: true, data }),
        });
      if (path === "/api/users/me")
        return ok({
          id: 9,
          nickname: "member",
          role: "USER",
          membershipType: "free",
          onboardingCompleted: true,
        });
      if (path === "/api/direct-analysis-history")
        return ok(scenario === "direct" ? direct : []);
      if (path === "/api/users/me/training-sessions") {
        const page = Number(url.searchParams.get("page"));
        const items =
          scenario === "empty"
            ? []
            : page === 0
              ? rows
              : [{ ...rows[0], sessionId: 900, title: "다음 페이지 기록" }];
        return ok({
          items,
          page,
          size: 20,
          totalElements: scenario === "empty" ? 0 : 9,
          totalPages: 2,
          hasNext: scenario === "pagination" && page === 0,
        });
      }
      if (/^\/api\/practice-contents\/\d+$/.test(path)) {
        const id = Number(path.split("/").pop());
        counts.set(id, (counts.get(id) ?? 0) + 1);
        if (id === 312 && metadataFailed)
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              result: false,
              message: "metadata unavailable",
              code: "UPSTREAM_UNAVAILABLE",
            }),
          });
        return ok({
          id,
          contentType: "SENTENCE",
          category: id === 316 ? "TITLE_EXAM" : "OTHER",
          origin: id === 312 ? "USER_INPUT" : "CATALOG",
          title: "원문",
          scriptText: "연습할 원문입니다.",
          difficulty: "BEGINNER",
          learningFocus: "PRONUNCIATION",
          estimatedSeconds: 10,
          referenceAudioAvailable: false,
        });
      }
      if (path === "/api/users/me/training-sessions/319") {
        detailReads++;
        if (scenario === "detail-retry" && detailReads === 1)
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              result: false,
              message: "상세를 일시적으로 불러올 수 없습니다.",
              code: "UPSTREAM_UNAVAILABLE",
            }),
          });
        return ok({
          session: {
            id: 319,
            status: "COMPLETED",
            startedAt: "2026-11-10T08:00:00Z",
            completedAt: "2026-11-10T09:00:00Z",
            totalLearningSeconds: 20,
          },
          content: { id: 312, title: "원문", scriptText: "연습할 원문입니다." },
          recording: { id: 55, durationMs: 5000, qualityStatus: "PASS" },
          analysis: { id: 88, transcript: null, overallScore: null },
          segments: [],
        });
      }
      if (path === "/api/v3/analyses/88")
        return ok({
          schemaVersion: "voice-coaching.canonical-analysis-view.v2",
          analysisProfile: "CANONICAL_HANDOFF_20261004_V5",
          analysisId: 88,
          recordingId: 55,
          requestId: feedbackResult.sourceIdentity.requestId,
          executionId: feedbackResult.sourceIdentity.executionId,
          jobStatus: "COMPLETED",
          serviceFailure: null,
          actions: {
            canComplete: true,
            canRetry: false,
            canRerecord: true,
            canRegenerate: false,
            unavailableReasonCodes: {
              complete: [],
              retry: [],
              rerecord: [],
              regenerate: [],
            },
          },
          canonicalAnalysis: {
            representation: "INLINE",
            decision: feedbackResult.decision,
            coreStatus: "ok",
            feedbackDeliveryAllowed: true,
            pronunciationFeedbackSource: "REFINED_P1_ONLY",
            selection: null,
            coaching: {
              schemaVersion: "canonical-llm-expression-result-v1",
              adapterStatus: "READY",
              generationStatus: "SCHEMA_AND_STRUCTURAL_SEMANTICS_VALID",
              items: [],
              feedback: "문구만 있는 정상 피드백",
              dispatchAttempts: 1,
              fallbackReason: null,
              naturalLanguageSemanticsFullyVerified: false,
              visualCorrectiveClaimsAllowed: false,
            },
            score,
            visual: { status: "NOT_CONNECTED", correctiveClaimsAllowed: false },
          },
        });
      return ok({ items: [], unreadCount: 0 });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/mypage/history");
    if (scenario === "empty")
      await page
        .getByText("아직 저장된 학습 기록이 없어요.", { exact: true })
        .waitFor();
    else await page.getByRole("link", { name: /완료 기록 319/ }).waitFor();
    if (scenario !== "empty") {
      await page.waitForFunction(
        () => !document.querySelector('a[href="/mypage/history/260"]'),
      );
      assert.equal(counts.get(312), 1, "shared content requested once");
      assert.equal(
        calls.filter(
          (p) =>
            /^\/api\/users\/me\/training-sessions\/\d+$/.test(p) ||
            p.startsWith("/api/v3/analyses/"),
        ).length,
        0,
        "no report detail HTTP before click",
      );
      assert.equal(
        await page.locator('a[href^="/mypage/history/"]').count(),
        7,
      );
    }
    if (scenario === "classification-failure") {
      await page
        .getByText(
          "일부 기록의 분류를 확인하지 못했어요. 완료된 기록은 계속 표시합니다.",
        )
        .waitFor();
      metadataFailed = false;
      await page
        .getByRole("button", { name: "다시 시도", exact: true })
        .click();
      await page.getByRole("button", { name: "내 문장", exact: true }).click();
      await page.getByRole("link", { name: /완료 기록 319/ }).waitFor();
      assert.equal(
        await page.locator('a[href^="/mypage/history/"]').count(),
        2,
      );
    }
    if (scenario === "direct") {
      await page
        .getByRole("strong")
        .filter({ hasText: "문구 리포트" })
        .waitFor();
      await page
        .getByRole("strong")
        .filter({ hasText: "교정 항목 리포트" })
        .waitFor();
      assert.equal(
        await page.getByText("실패 리포트", { exact: true }).count(),
        0,
      );
    }
    if (scenario === "pagination") {
      await page
        .getByRole("button", { name: "기록 더 보기", exact: true })
        .click();
      await page.getByRole("link", { name: /다음 페이지 기록/ }).waitFor();
      assert.equal(counts.get(312), 1, "cached metadata reused on next page");
    }
    if (scenario === "detail-retry") {
      await page.getByRole("link", { name: /완료 기록 319/ }).click();
      await page
        .getByText("상세를 일시적으로 불러올 수 없습니다.", { exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "다시 시도", exact: true })
        .click();
      await page
        .getByText("연습할 원문입니다.", { exact: false })
        .first()
        .waitFor();
      assert.equal(detailReads, 2);
      assert(calls.includes("/api/v3/analyses/88"));
    }
    assert.deepEqual(errors, []);
    console.log("PASS", scenario);
    await context.close();
  }
} finally {
  await browser.close();
}
