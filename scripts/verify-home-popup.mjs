import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const base = process.env.HOME_TEST_BASE_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Local fixtures only");
const artifacts =
  process.env.HOME_TEST_ARTIFACT_DIR ?? "/tmp/vc-premium-trial-qa";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.HOME_BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.HOME_BROWSER_EXECUTABLE_PATH }
    : {}),
});
const eligible = {
  status: "ELIGIBLE",
  eligible: true,
  startsAt: null,
  expiresAt: null,
};
const active = {
  status: "ACTIVE",
  eligible: false,
  startsAt: "2026-11-09T03:00:00Z",
  expiresAt: "2026-11-12T03:00:00Z",
};
try {
  for (const scenario of [
    "activate",
    "retry",
    "close",
    "details",
    "paid",
    "expired",
    "unavailable",
    "small",
    "desktop",
  ]) {
    const viewport =
      scenario === "desktop"
        ? { width: 1280, height: 900 }
        : scenario === "small"
          ? { width: 320, height: 568 }
          : { width: 402, height: 874 };
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("speakai.access-token", "trial-fixture"),
    );
    let posts = 0,
      activated = false;
    const errors = [];
    await context.route("**/api/backend/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname.replace("/api/backend", "");
      const reply = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(
            status === 200
              ? { result: true, data }
              : {
                  result: false,
                  code: "UNAVAILABLE",
                  message: "fixture unavailable",
                },
          ),
        });
      if (path === "/api/users/me/premium-trial") {
        if (req.method() === "POST") {
          posts++;
          assert.equal(req.postData(), null);
          if (scenario === "retry" && posts === 1) return reply(null, 503);
          await new Promise((resolve) => setTimeout(resolve, 200));
          activated = true;
          return reply(active);
        }
        return scenario === "unavailable"
          ? reply(null, 503)
          : reply(
              activated
                ? active
                : scenario === "paid"
                  ? { ...eligible, status: "INELIGIBLE", eligible: false }
                  : scenario === "expired"
                    ? { ...active, status: "EXPIRED" }
                    : eligible,
            );
      }
      if (path === "/api/users/me")
        return reply({
          id: 1,
          nickname: "fixture",
          onboardingCompleted: true,
          role: "USER",
          membershipType: activated || scenario === "paid" ? "paid" : "free",
          membershipEnvironment: activated ? "TRIAL" : null,
        });
      if (path === "/api/home")
        return reply({
          today: { completedCount: 0, goalCount: 1, learningSeconds: 0 },
          recommendations: [],
          recentTraining: null,
          courseProgress: null,
        });
      if (path === "/api/recommendations") return reply({ items: [] });
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
          items: [],
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
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !(
          ["retry", "unavailable"].includes(scenario) &&
          message.text().includes("503")
        )
      )
        errors.push(message.text());
    });
    await page.goto(`${base}/home/`);
    await page
      .getByRole("heading", { name: "무엇을 연습할까요?", includeHidden: true })
      .waitFor({ state: "attached" });
    assert.match(await page.title(), /SpeakAI/);
    const dialog = page.getByRole("dialog");
    if (["paid", "expired", "unavailable"].includes(scenario)) {
      await page.waitForLoadState("networkidle");
      assert.equal(await dialog.count(), 0);
    } else {
      await dialog.waitFor();
      await page.evaluate(() => document.fonts.ready);
      const box = await dialog.boundingBox();
      assert.deepEqual(box, { x: 0, y: 0, ...viewport });
      const start = dialog.getByRole("button", {
        name: "프리미엄으로 연습 시작하기",
      });
      assert.equal(posts, 0);
      for (const img of await dialog.locator("img").all()) {
        await img.evaluate((el) => el.decode());
        assert.ok(await img.evaluate((el) => el.naturalWidth > 0));
      }
      const geometry = await dialog.locator("img").evaluateAll((imgs) =>
        imgs.map((el) => ({
          src: el.getAttribute("src"),
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        })),
      );
      if (scenario === "activate") {
        const cta = await start.boundingBox();
        assert.equal(cta.x, 20);
        assert.equal(cta.width, 362);
        assert.ok(Math.abs(cta.y - 750) <= 1, JSON.stringify(cta));
        assert.equal(cta.height, 58);
        console.log(JSON.stringify({ geometry, cta }));
      }
      await page.screenshot({ path: join(artifacts, `${scenario}.png`) });
      assert.equal(
        await dialog.evaluate((el) => el.scrollWidth > el.clientWidth),
        false,
      );
      if (scenario === "details") {
        await dialog
          .getByRole("link", { name: "프리미엄 혜택 자세히 보기" })
          .click();
        await page.waitForURL("**/mypage/payments?view=purchase");
        assert.equal(posts, 0);
      } else if (["close", "small", "desktop"].includes(scenario)) {
        if (scenario === "small") {
          await start.scrollIntoViewIfNeeded();
          assert.ok(await start.isVisible());
          await page.screenshot({ path: join(artifacts, "small-cta.png") });
        }
        await dialog.getByRole("button", { name: "닫기", exact: true }).click();
        await dialog.waitFor({ state: "detached" });
        assert.equal(posts, 0);
        if (scenario === "close") {
          await page.reload();
          await dialog.waitFor();
          assert.equal(posts, 0);
        }
      } else {
        if (scenario === "activate")
          await start.evaluate((button) => {
            button.click();
            button.click();
          });
        else await start.click();
        if (scenario === "retry") {
          await dialog.getByRole("alert").waitFor();
          assert.equal(posts, 1);
          await start.click();
        }
        await dialog.waitFor({ state: "detached" });
        await page.getByText("72시간 프리미엄 체험이 시작됐어요.").waitFor();
        assert.equal(posts, scenario === "retry" ? 2 : 1);
        await page.reload();
        await page.waitForLoadState("networkidle");
        assert.equal(await dialog.count(), 0);
      }
    }
    assert.equal(
      await page
        .locator("nextjs-portal")
        .evaluateAll((els) =>
          els.some((el) =>
            el.shadowRoot?.querySelector("[data-nextjs-dialog-overlay]"),
          ),
        ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(`PASS ${scenario}`);
    await context.close();
  }
} finally {
  await browser.close();
}
