import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PRACTICE_TEST_BASE_URL ?? "http://localhost:3132";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Local fixtures only");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PRACTICE_BROWSER_EXECUTABLE_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const original = JSON.parse(
  await readFile(
    new URL("./fixtures/lip-analysis-view.json", import.meta.url),
    "utf8",
  ),
);
try {
  for (const scenario of [
    "automatic-pass",
    "manual-failed",
    "transient-409",
    "manual-transient-409",
    "changed-attempt",
    "grade-error",
  ]) {
    const context = await browser.newContext({
      viewport: { width: 400, height: 811 },
    });
    await context.addInitScript(() =>
      localStorage.setItem("speakai.access-token", "local-fixture"),
    );
    let saved = false,
      reads = 0,
      gradeCalls = 0,
      releaseGrade,
      conflicted = false,
      changedAttempt = false;
    const gradeWait = new Promise((resolve) => {
      releaseGrade = resolve;
    });
    const writes = [];
    const current = structuredClone(original);
    current.actions.canComplete = true;
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
              : { result: false, code, message: "fixture error" },
          ),
        });
      if (request.method() !== "GET") writes.push(path);
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
          title: "시험 문장",
          scriptText: "오늘의 소식을 전합니다.",
          learningFocus: "PRONUNCIATION",
          referenceAudioAvailable: false,
        });
      if (path === "/api/users/me/title-exams/2")
        return reply({
          id: 2,
          practiceContentId: 183,
          trainingSessionId: 77,
          status: "IN_PROGRESS",
        });
      if (path === "/api/training-sessions/77")
        return reply({
          id: 77,
          status: "ANALYZING",
          content: { id: 183 },
          selectedRecordingId: 55,
          analysisAvailable: true,
        });
      if (path.endsWith("/recordings"))
        return reply({
          items: [
            {
              id: 55,
              recordingId: 55,
              selected: true,
              qualityStatus: "PASS",
              attemptNo: 1,
              durationMs: 10000,
            },
          ],
        });
      if (path.endsWith("/analysis/status"))
        return reply({
          status: "COMPLETED",
          analysisId: 88,
          progressPercent: 100,
        });
      if (path === "/api/v3/analyses/88") {
        reads++;
        if (
          !conflicted &&
          ((scenario === "transient-409" && reads === 2) ||
            (scenario === "manual-transient-409" && saved))
        ) {
          conflicted = true;
          return reply(null, 409, "CANONICAL_ANALYSIS_CHANGED");
        }
        if (scenario === "changed-attempt" && changedAttempt)
          return reply({
            ...current,
            executionId: "00000000-0000-4000-8000-000000000099",
          });
        return reply({
          ...current,
          persistenceStatus: saved ? "SAVED" : "SAVING",
        });
      }
      if (path.endsWith("/complete")) return reply({ completed: true });
      if (path.endsWith("/title-exams/2/submit")) {
        gradeCalls++;
        assert.deepEqual(request.postDataJSON(), { analysisId: 88 });
        await gradeWait;
        if (scenario === "grade-error")
          return reply(null, 503, "TEMPORARY_UNAVAILABLE");
        const passed = scenario !== "manual-failed";
        return reply({
          status: passed ? "PASSED" : "FAILED",
          passed,
          score: passed ? 80 : 60,
          passingScore: 70,
          previousTitle: "입문",
          currentTitle: passed ? "초보" : "입문",
        });
      }
      return reply({ items: [], totalElements: 0 });
    });
    const page = await context.newPage();
    await page.goto(`${base}/practice/183?titleExamId=2&start=1`);
    await page
      .getByRole("button", { name: "이어서 진행", exact: true })
      .click();
    await page
      .getByRole("button", { name: "저장·완료 상태 다시 확인", exact: true })
      .waitFor();
    if (scenario === "changed-attempt") {
      changedAttempt = true;
      await page
        .getByRole("button", { name: "저장·완료 상태 다시 확인", exact: true })
        .click();
      await page.waitForFunction(
        () => !document.body.innerText.includes("저장·완료 상태 다시 확인"),
      );
      assert.equal(gradeCalls, 0);
      assert.equal(writes.length, 0);
    } else {
      saved = true;
      if (scenario === "manual-failed" || scenario === "manual-transient-409")
        await page
          .getByRole("button", {
            name: "저장·완료 상태 다시 확인",
            exact: true,
          })
          .click();
      await page
        .getByRole("button", { name: "승급 시험 채점 중…", exact: true })
        .waitFor({ timeout: 15000 });
      assert.equal(
        await page
          .getByRole("button", { name: "승급 시험 채점 중…", exact: true })
          .isDisabled(),
        true,
      );
      assert.ok(
        writes.indexOf("/api/training-sessions/77/complete") <
          writes.indexOf("/api/users/me/title-exams/2/submit"),
      );
      releaseGrade();
      if (scenario === "grade-error") {
        await page
          .getByRole("button", { name: "채점 다시 확인", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "승급 채점 확인 필요", exact: true })
            .isDisabled(),
          true,
        );
      } else {
        await page
          .getByRole("button", { name: "완료하기", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "완료하기", exact: true })
            .isEnabled(),
          true,
        );
      }
      assert.equal(gradeCalls, 1);
      assert.ok(
        writes.every(
          (path) => path.endsWith("/complete") || path.endsWith("/submit"),
        ),
      );
    }
    console.log(`PASS ${scenario}`);
    await context.close();
  }
} finally {
  await browser.close();
}
