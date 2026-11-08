import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const base = process.env.HOME_TEST_BASE_URL ?? "http://localhost:3134";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Local fixtures only");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.HOME_BROWSER_EXECUTABLE_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const popup = {
  id: 42,
  title: "새로운 소식을 알려드려요",
  body: "더 편리한 음성 연습을 준비했어요.\n자세한 내용은 알림에서 확인해 주세요.",
  deepLink: "/notifications",
  startsAt: "2026-11-01T00:00:00Z",
  endsAt: "2026-12-01T00:00:00Z",
};
const artifactDir =
  process.env.HOME_TEST_ARTIFACT_DIR ?? "test-artifacts/home-popup";
await mkdir(artifactDir, { recursive: true });
try {
  for (const scenario of [
    "active",
    "none",
    "error",
    "unsafe",
    "long",
    "link",
    "weekly",
  ]) {
    const context = await browser.newContext({
      viewport:
        scenario === "long"
          ? { width: 320, height: 568 }
          : { width: 400, height: 811 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("speakai.access-token", "popup-fixture"),
    );
    const calls = [],
      errors = [];
    let currentPopupId = popup.id,
      currentUserId = 1;
    await context.route("**/api/backend/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname.replace("/api/backend", "");
      calls.push(`${request.method()} ${path}`);
      const reply = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(
            status === 200
              ? { result: true, data }
              : { result: false, code: "UNAVAILABLE" },
          ),
        });
      if (path === "/api/users/me")
        return reply({
          id: currentUserId,
          nickname: "fixture",
          onboardingCompleted: true,
          role: "USER",
        });
      if (path === "/api/users/me/popup") {
        if (scenario === "none") return reply(null);
        if (scenario === "error") return reply(null, 503);
        return reply(
          scenario === "unsafe"
            ? { ...popup, deepLink: "https://example.invalid" }
            : scenario === "long"
              ? {
                  ...popup,
                  title: "긴 제목 ".repeat(30),
                  body: "긴 안내 문구입니다.\n".repeat(65),
                  deepLink: null,
                }
              : { ...popup, id: currentPopupId },
        );
      }
      if (path === "/api/home")
        return reply({
          today: { completedCount: 0, goalCount: 1, learningSeconds: 0 },
          recommendations: [],
          recentTraining: null,
          courseProgress: null,
        });
      if (path === "/api/recommendations")
        return reply({
          items: [
            { contentId: 183, title: "오늘의 뉴스", reason: "일곱 문장 연습" },
          ],
        });
      if (path === "/api/users/me/statistics")
        return reply({ consecutiveLearningDays: 2 });
      if (path === "/api/practice-contents/popular")
        return reply({
          type: "NEWS",
          rankingBasis: "COMPLETED_USERS",
          periodStart: "2026-11-06T00:00:00Z",
          periodEnd: "2026-11-07T00:00:00Z",
          generatedAt: "2026-11-07T00:00:00Z",
          nextUpdateAt: "2099-01-01T00:00:00Z",
          items: [
            {
              rank: 1,
              id: 183,
              title: "청년 봉사단",
              contentType: "NEWS",
              difficulty: "BEGINNER",
              usageCount: 1,
              estimatedSeconds: 30,
            },
          ],
        });
      return reply({
        items: [],
        unreadCount: 0,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
      });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/home`);
    // Include content hidden from assistive technology while the modal is open.
    const homeHeading = page.getByRole("heading", {
      name: "무엇을 연습할까요?",
      includeHidden: true,
    });
    await homeHeading.waitFor({ state: "attached" });
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const box = await dialog.boundingBox(),
      viewport = page.viewportSize();
    assert.ok(Math.abs(box.x) <= 1);
    assert.ok(Math.abs(box.y) <= 1);
    assert.ok(Math.abs(box.width - viewport.width) <= 1);
    assert.ok(Math.abs(box.height - viewport.height) <= 1);
    assert.equal(
      await dialog.getByRole("button", { name: "닫기", exact: true }).count(),
      0,
    );
    assert.ok(
      await dialog
        .getByText("신규 가입 시 3일간 프로 요금제를 제공해요")
        .isVisible(),
    );
    if (["none", "error", "unsafe"].includes(scenario)) {
      assert.ok(
        await dialog
          .getByRole("heading", { name: "첫 3일은 프로로 시작하세요" })
          .isVisible(),
      );
      await page.getByRole("button", { name: "확인", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      assert.ok(await homeHeading.isVisible());
    } else if (scenario === "active") {
      const originalPosition = await homeHeading.boundingBox();
      await page.screenshot({
        path: join(artifactDir, "mobile-popup.png"),
        animations: "disabled",
      });
      await page.getByRole("button", { name: "확인", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      assert.deepEqual(await homeHeading.boundingBox(), originalPosition);
      await page.screenshot({
        path: join(artifactDir, "mobile-dismissed.png"),
        animations: "disabled",
      });
      await page.reload();
      await dialog.waitFor();
    } else if (scenario === "long") {
      assert.equal(await dialog.getByRole("link").count(), 0);
      await page.getByRole("button", { name: "확인", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
    } else if (scenario === "weekly") {
      const started = Date.now();
      await page.getByRole("button", { name: "일주일간 보지 않기" }).click();
      await dialog.waitFor({ state: "detached" });
      const expiresAt = await page.evaluate(() =>
        Number(localStorage.getItem("speakai.popup-hidden-until.v1:1:42")),
      );
      assert.ok(
        expiresAt >= started + 7 * 86400000 &&
          expiresAt <= Date.now() + 7 * 86400000,
      );
      await Promise.all([
        page.waitForResponse((response) =>
          response.url().endsWith("/api/users/me/popup"),
        ),
        page.reload(),
      ]);
      await homeHeading.waitFor({ state: "attached" });
      assert.equal(await dialog.count(), 0);
      currentPopupId = 43;
      await page.reload();
      await dialog.waitFor();
      await page.getByRole("button", { name: "일주일간 보지 않기" }).click();
      currentUserId = 2;
      await page.reload();
      await dialog.waitFor();
      currentUserId = 1;
      currentPopupId = 42;
      await page.evaluate(() =>
        localStorage.setItem("speakai.popup-hidden-until.v1:1:42", "0"),
      );
      await page.reload();
      await dialog.waitFor();
    } else {
      assert.equal(
        await page
          .getByRole("link", { name: "자세히 보기" })
          .getAttribute("href"),
        "/home/notifications",
      );
      await page.getByRole("link", { name: "자세히 보기" }).click();
      await page.waitForURL("**/home/notifications");
      await page.goBack();
      await homeHeading.waitFor({ state: "attached" });
      assert.equal(await dialog.count(), 0);
    }
    assert.equal(
      calls.some((call) => !call.startsWith("GET ")),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(`PASS ${scenario}`);
    await context.close();
  }
} finally {
  await browser.close();
}
