import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.ADMIN_TEST_BASE_URL ?? "http://127.0.0.1:3136";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Local fixtures only");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.ADMIN_BROWSER_EXECUTABLE_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const initial = {
  id: 501,
  version: 1,
  courseType: "INTONATION",
  title: "억양 고급 클래스",
  description: "억양을 연습합니다.",
  difficulty: "ADVANCED",
  status: "PUBLISHED",
  estimatedMinutes: 5,
  updatedAt: "2026-11-08T00:00:00Z",
  sentences: Array.from({ length: 5 }, (_, i) => ({
    contentId: 260 + i,
    contentVersion: 0,
    title: `억양 문장 ${i + 1}`,
    text: `기존 원문 ${i + 1}`,
    hint: "문장 안내",
    focus: "INTONATION",
    estimatedSeconds: 15,
  })),
};
try {
  for (const scenario of ["edit", "conflict", "create", "mobile", "denied"]) {
    const context = await browser.newContext({
      viewport: { width: scenario === "mobile" ? 390 : 1280, height: 900 },
    });
    await context.addInitScript(() =>
      localStorage.setItem("speakai.access-token", "fixture"),
    );
    let current = structuredClone(initial),
      writes = [],
      excluded = false;
    const page = await context.newPage();
    await context.route("**/api/backend/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname.replace("/api/backend/api", "");
      const reply = (data, status = 200, code) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(
            status === 200
              ? { result: true, data }
              : { result: false, code, message: "fixture conflict" },
          ),
        });
      if (request.method() !== "GET")
        writes.push({
          path,
          method: request.method(),
          body: request.postDataJSON(),
        });
      if (path === "/users/me")
        return reply({
          id: 9001,
          role: "ADMIN",
          nickname: "운영 관리자",
          onboardingCompleted: true,
        });
      if (path === "/admin/me")
        return scenario === "denied"
          ? reply(null, 403, "FORBIDDEN")
          : reply({ id: 9001, nickname: "관리자", role: "ADMIN" });
      if (path === "/admin/courses" && request.method() === "GET")
        return reply({
          items: [current],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        });
      if (path === "/admin/contents") {
        excluded = url.searchParams.get("excludeClassPractice") === "true";
        return reply({
          items: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
        });
      }
      if (path === "/admin/courses/501" && request.method() === "GET")
        return reply(current);
      if (path === "/admin/courses/501" && request.method() === "PATCH") {
        if (scenario === "conflict")
          return reply(null, 409, "ADMIN_EDIT_CONFLICT");
        const body = request.postDataJSON();
        assert.equal(body.version, 1);
        assert.equal(body.course.sentences.length, 5);
        assert.equal(body.course.sentences[0].text, "수정한 첫 문장");
        assert.ok(
          !body.course.sentences.some((item) => item.contentId === 261),
        );
        current = {
          ...current,
          ...body.course,
          version: 2,
          sentences: body.course.sentences.map((s, i) => ({
            ...s,
            contentId: 800 + i,
            contentVersion: 0,
          })),
        };
        return reply(current);
      }
      if (path === "/admin/courses" && request.method() === "POST") {
        const body = request.postDataJSON();
        assert.equal(body.course.sentences.length, 5);
        assert.equal(body.course.courseType, "INTONATION");
        assert.ok(body.course.sentences.every((s) => s.contentId === null));
        current = {
          ...current,
          ...body.course,
          version: 1,
          sentences: body.course.sentences.map((s, i) => ({
            ...s,
            contentId: 900 + i,
            contentVersion: 0,
          })),
        };
        return reply(current);
      }
      return reply({
        items: [],
        totalElements: 0,
        totalPages: 0,
        page: 0,
        size: 20,
        hasNext: false,
      });
    });
    await page.goto(`${base}/admin/contents`);
    if (scenario === "denied") {
      await page
        .getByRole("heading", {
          name: "관리자 접근을 확인해 주세요",
          exact: true,
        })
        .first()
        .waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: initial.title, exact: true })
          .count(),
        0,
      );
      assert.equal(writes.length, 0);
      console.log("PASS denied");
      await context.close();
      continue;
    }
    const link = page.getByRole("link", { name: initial.title, exact: true });
    await link.waitFor();
    assert.equal(await link.count(), 1);
    assert.equal(
      await page
        .getByRole("link", { name: "억양 문장 1", exact: true })
        .count(),
      0,
    );
    assert.equal(excluded, true);
    if (scenario === "create")
      await page
        .getByRole("link", { name: "클래스 추가", exact: true })
        .click();
    else await link.click();
    if (scenario === "create") {
      await page
        .getByLabel("클래스 제목", { exact: true })
        .fill("새 억양 클래스");
      await page
        .getByLabel("클래스 유형", { exact: true })
        .selectOption("INTONATION");
      for (let i = 1; i <= 5; i++) {
        if (i > 1)
          await page
            .getByRole("button", { name: "문장 추가", exact: true })
            .click();
        await page
          .getByLabel(`${i}번 문장 제목`, { exact: true })
          .fill(`새 문장 ${i}`);
        await page
          .getByLabel(`${i}번 연습 문장`, { exact: true })
          .fill(`새로운 원문 ${i}`);
      }
    } else {
      await page.getByLabel("5번 연습 문장", { exact: true }).waitFor();
      assert.equal(await page.locator("fieldset").count(), 5);
      if (scenario === "mobile") {
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          true,
        );
        console.log("PASS mobile five sentences");
        await context.close();
        continue;
      }
      await page
        .getByLabel("1번 연습 문장", { exact: true })
        .fill("수정한 첫 문장");
      if (scenario === "edit") {
        await page
          .getByRole("button", { name: "2번 문장 삭제", exact: true })
          .click();
        assert.equal(writes.length, 0);
        assert.equal(await page.locator("fieldset").count(), 4);
        await page
          .getByRole("button", { name: "문장 추가", exact: true })
          .click();
        await page
          .getByLabel("5번 문장 제목", { exact: true })
          .fill("새 마지막 문장");
        await page
          .getByLabel("5번 연습 문장", { exact: true })
          .fill("새 마지막 원문");
      }
    }
    await page
      .getByLabel("작업 사유", { exact: true })
      .fill("클래스 문장 구성 변경");
    await page
      .getByRole("button", {
        name: scenario === "create" ? "클래스 등록" : "클래스 변경사항 저장",
        exact: true,
      })
      .click();
    if (scenario === "conflict") {
      await page
        .getByText("다른 관리자가 수정했거나 상태가 변경되었습니다.", {
          exact: false,
        })
        .waitFor();
      assert.equal(
        await page.getByLabel("1번 연습 문장", { exact: true }).inputValue(),
        "수정한 첫 문장",
      );
    } else {
      await page.waitForFunction(
        (expected) =>
          document.querySelector("h1")?.textContent === "클래스 설정" &&
          Array.from(document.querySelectorAll("textarea")).some(
            (node) => node.value === expected,
          ),
        scenario === "create" ? "새로운 원문 5" : "새 마지막 원문",
      );
    }
    assert.equal(writes.length, 1);
    assert.ok(writes.every((write) => write.path.startsWith("/admin/courses")));
    console.log(`PASS ${scenario}`);
    await context.close();
  }
} finally {
  await browser.close();
}
