import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.ADMIN_TEST_BASE_URL ?? "http://127.0.0.1:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Local fixtures only");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.ADMIN_BROWSER_EXECUTABLE_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const now = "2026-11-11T01:00:00Z";
const member = (id) => ({
  id,
  nickname: `회원 ${id}`,
  maskedEmail: `m***@example.invalid`,
  status: "ACTIVE",
  role: "USER",
  createdAt: now,
  membershipType: "free",
  membershipExpiresAt: null,
  membershipEnvironment: null,
  loginProviders: ["LOCAL"],
});
try {
  for (const scenario of ["inbox-link", "recipient-pages", "recipient-error"]) {
    const context = await browser.newContext({
      viewport: { width: 400, height: 850 },
    });
    await context.addInitScript(() => {
      localStorage.setItem("speakai.access-token", "notification-fixture");
      localStorage.setItem("ttobak.terms.accepted.9", "{}");
    });
    let reads = 0,
      saved = null,
      drafts = 0,
      dispatches = 0,
      fail = scenario === "recipient-error";
    await context.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace("/api/backend", "");
      const ok = (data) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ result: true, data }),
        });
      if (path === "/api/admin/me")
        return ok({ id: 9, nickname: "operator", role: "ADMIN" });
      if (path === "/api/users/me")
        return ok({
          id: 9,
          nickname: "member",
          role: "USER",
          membershipType: "free",
          onboardingCompleted: true,
        });
      if (path === "/api/notifications")
        return ok({
          items: [
            {
              id: 1,
              type: "ADMIN_GENERAL",
              title: "공지 알림",
              body: "알림함으로 이동",
              createdAt: now,
              deepLink: "/notifications",
              readAt: null,
            },
          ],
          unreadCount: 1,
          page: 0,
          size: 50,
          totalElements: 1,
          hasNext: false,
        });
      if (path === "/api/notifications/1/read") {
        reads++;
        return ok({ id: 1, readAt: now });
      }
      if (path === "/api/admin/users") {
        assert.equal(url.searchParams.get("status"), "ACTIVE");
        if (fail)
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              result: false,
              message: "회원 목록 일시 오류",
              code: "ADMIN_STORE_UNAVAILABLE",
            }),
          });
        const page = Number(url.searchParams.get("page"));
        const keyword = url.searchParams.get("keyword");
        const items =
          keyword === "없음"
            ? []
            : keyword
              ? [member(5)]
              : page === 0
                ? [member(1), member(2)]
                : [member(4)];
        return ok({
          items,
          page,
          size: 20,
          totalElements: keyword ? items.length : 3,
          totalPages: keyword ? 1 : 2,
          hasNext: !keyword && page === 0,
        });
      }
      if (
        path === "/api/admin/notification-campaigns" &&
        route.request().method() === "POST"
      ) {
        drafts++;
        saved = route.request().postDataJSON();
        return ok({
          id: 11,
          version: 0,
          status: "DRAFT",
          audienceCount: 3,
          createdAt: now,
          sentAt: null,
          sentCount: 0,
          ...saved,
        });
      }
      if (path === "/api/admin/notification-campaigns/11")
        return ok({
          id: 11,
          version: 0,
          status: "DRAFT",
          audienceCount: 3,
          createdAt: now,
          sentAt: null,
          sentCount: 0,
          ...saved,
        });
      if (path.endsWith("/dispatch")) {
        dispatches++;
        return ok({});
      }
      return ok({ items: [], unreadCount: 0 });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (scenario === "inbox-link") {
      await page.goto(base + "/home/notifications");
      const notice = page.getByRole("link", { name: /공지 알림/ });
      await notice.waitFor();
      assert.equal(await notice.getAttribute("href"), "/home/notifications");
      const read = page.waitForResponse((r) =>
        r.url().endsWith("/api/notifications/1/read"),
      );
      await notice.click();
      await read;
      await page.waitForFunction(
        () => location.pathname === "/home/notifications",
      );
      assert.equal(reads, 1);
      assert.equal(await page.getByText("404", { exact: true }).count(), 0);
    } else {
      await page.goto(base + "/admin/notifications/new");
      await page
        .getByLabel("발송 대상", { exact: true })
        .selectOption("SELECTED_USERS");
      assert.equal(
        await page
          .getByRole("button", { name: "초안 저장·검토", exact: true })
          .isDisabled(),
        true,
      );
      if (scenario === "recipient-error") {
        await page.getByText("회원 목록 일시 오류", { exact: true }).waitFor();
        fail = false;
        await page
          .getByRole("button", { name: "다시 조회", exact: true })
          .click();
      }
      await page
        .getByRole("checkbox", { name: "회원 1 #1", exact: true })
        .check();
      await page
        .getByRole("button", { name: "다음 페이지", exact: true })
        .click();
      await page
        .getByRole("checkbox", { name: "회원 4 #4", exact: true })
        .check();
      assert.equal(
        await page
          .getByRole("button", { name: "회원 #1 선택 해제", exact: true })
          .count(),
        1,
      );
      await page.getByLabel("회원 이름 검색", { exact: true }).fill("회원");
      await page.getByLabel("회원 이름 검색", { exact: true }).press("Enter");
      await page
        .getByRole("checkbox", { name: "회원 5 #5", exact: true })
        .check();
      assert.equal(
        drafts,
        0,
        "search Enter does not submit the outer draft form",
      );
      await page
        .getByRole("button", { name: "현재 페이지 해제", exact: true })
        .click();
      await page
        .getByRole("button", { name: "현재 페이지 선택", exact: true })
        .click();
      await page.getByLabel("회원 이름 검색", { exact: true }).fill("없음");
      await page.getByRole("button", { name: "검색", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('input[name="userIds"]')?.value === "1,4,5",
      );
      await page
        .getByLabel("발송 대상", { exact: true })
        .selectOption("ALL_ACTIVE");
      await page
        .getByLabel("발송 대상", { exact: true })
        .selectOption("SELECTED_USERS");
      assert.equal(
        await page.locator('input[name="userIds"]').inputValue(),
        "1,4,5",
      );
      await page
        .getByLabel("알림 제목", { exact: true })
        .fill("선택 회원 안내");
      await page
        .getByLabel("알림 본문", { exact: true })
        .fill("선택한 회원에게만 전달할 안내입니다.");
      await page
        .getByLabel("작업 사유", { exact: true })
        .fill("알림 초안 테스트");
      await page
        .getByRole("button", { name: "초안 저장·검토", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "알림 검토·발송", exact: true })
        .waitFor();
      assert.deepEqual(saved.userIds, [1, 4, 5]);
      assert.equal(saved.deepLink, "/notifications");
      assert.equal(drafts, 1);
      assert.equal(dispatches, 0);
    }
    assert.deepEqual(errors, []);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "mobile layout fits viewport",
    );
    console.log("PASS", scenario);
    await context.close();
  }
} finally {
  await browser.close();
}
