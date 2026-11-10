import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.ADMIN_TEST_BASE_URL ?? "http://127.0.0.1:3100";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Local fixtures only");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.ADMIN_BROWSER_EXECUTABLE_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const jwt = (role) =>
  `header.${Buffer.from(JSON.stringify({ iss: "voice-test", sub: "9", sid: "login", role, type: "access", exp: 9999999999 })).toString("base64url")}.signature`;
try {
  for (const scenario of [
    "opaque-denied",
    "forged-admin-denied",
    "user-early-denied",
    "account-switch",
    "entry-denied",
  ]) {
    const context = await browser.newContext();
    const token = ["opaque-denied", "entry-denied"].includes(scenario)
      ? "opaque-fixture"
      : jwt(scenario === "user-early-denied" ? "USER" : "ADMIN");
    await context.addInitScript(
      (value) => localStorage.setItem("speakai.access-token", value),
      token,
    );
    let checks = 0,
      approved = scenario === "account-switch";
    await context.route("**/api/backend/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/api/users/me/notification-preferences"))
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            result: true,
            data: {
              practiceReminder: {
                enabled: false,
                time: "09:00",
                daysOfWeek: [],
                timezone: "Asia/Seoul",
              },
              marketing: { enabled: false },
              updatedAt: "2026-11-01T00:00:00Z",
            },
          }),
        });
      if (path.endsWith("/api/admin/me")) {
        checks++;
        return route.fulfill({
          status: approved ? 200 : 403,
          contentType: "application/json",
          body: JSON.stringify(
            approved
              ? {
                  result: true,
                  data: { id: 9, nickname: "operator", role: "ADMIN" },
                }
              : { result: false, code: "ACCESS_DENIED", message: "denied" },
          ),
        });
      }
      if (path.endsWith("/api/admin/users"))
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            result: true,
            data: {
              items: [
                {
                  id: 10,
                  nickname: "protected-member",
                  maskedEmail: "m***@example.invalid",
                  role: "USER",
                  status: "ACTIVE",
                  membershipType: "free",
                  createdAt: "2026-11-01T00:00:00Z",
                },
              ],
              page: 0,
              size: 20,
              totalElements: 1,
              totalPages: 1,
              hasNext: false,
            },
          }),
        });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          result: true,
          data: {
            id: 9,
            nickname: "member",
            role: "USER",
            membershipType: "free",
            onboardingCompleted: true,
            items: [],
            unreadCount: 0,
          },
        }),
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const entryDenial =
      scenario === "entry-denied"
        ? page.waitForResponse(
            (r) => r.url().endsWith("/api/admin/me") && r.status() === 403,
          )
        : null;
    await page.goto(
      base +
        (scenario === "entry-denied" ? "/mypage/settings" : "/admin/users"),
    );
    if (entryDenial) await entryDenial;
    if (approved) {
      await page.getByText("protected-member", { exact: true }).waitFor();
      approved = false;
      await page.evaluate((value) => {
        localStorage.setItem("speakai.access-token", value);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "speakai.access-token",
            newValue: value,
          }),
        );
      }, jwt("USER"));
    }
    await page
      .getByRole("heading", {
        name:
          scenario === "entry-denied" ? "설정" : "관리자 접근을 확인해 주세요",
        exact: true,
      })
      .waitFor();
    const before = checks;
    for (let i = 0; i < 3; i++)
      await page.evaluate(() =>
        window.dispatchEvent(new Event("visibilitychange")),
      );
    await page.waitForTimeout(1200);
    assert.equal(
      await page.getByRole("navigation", { name: "관리자 메뉴" }).count(),
      0,
    );
    if (scenario === "entry-denied")
      assert.equal(
        await page
          .getByRole("link", { name: "관리자 페이지", exact: true })
          .count(),
        0,
      );
    assert.equal(
      await page.getByText("protected-member", { exact: true }).count(),
      0,
    );
    assert.equal(
      checks,
      before,
      `${scenario}: repeated /admin/me requests after denial: ${before} -> ${checks}`,
    );
    if (scenario === "user-early-denied") assert.equal(checks, 0);
    else if (scenario !== "account-switch") assert.equal(checks, 1);
    assert.deepEqual(errors, []);
    console.log(`PASS ${scenario}: access requests=${checks}`);
    await context.close();
  }
} finally {
  await browser.close();
}
