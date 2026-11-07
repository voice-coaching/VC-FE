import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.ADMIN_TEST_BASE_URL || "http://127.0.0.1:3100";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Local fixtures only");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ADMIN_BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.ADMIN_BROWSER_EXECUTABLE_PATH }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
});
await context.addInitScript(() =>
  localStorage.setItem("speakai.access-token", "title-admin-fixture"),
);
const content = (id) => ({
  id,
  version: 2,
  type: "SENTENCE",
  category: "TITLE_EXAM",
  focus: "PRONUNCIATION",
  difficulty: "BEGINNER",
  title: id === 10 ? "기존 시험" : "새 시험",
  scriptText:
    id === 10 ? "기존 시험 문장입니다." : "새로운 시험 문장을 정확히 읽습니다.",
  description: "시험 안내",
  status: "PUBLISHED",
  publishedAt: null,
  updatedAt: "2026-11-07T00:00:00Z",
  targetPronunciations: [],
  estimatedSeconds: 10,
});
let policy = {
  targetRank: "BEGINNER",
  targetTitle: "초보",
  version: 0,
  passingScore: 70,
  requiredTrainingCount: 5,
  practiceContentId: 10,
  available: true,
  content: content(10),
};
let conflict = false,
  denied = false,
  empty = false,
  multiplePolicies = false;
const ranks = [
  "BEGINNER",
  "LOCAL_ANNOUNCER",
  "ASPIRING_ANNOUNCER",
  "ANNOUNCER",
];
const titles = ["초보", "동네 아나운서", "아나운서 지망생", "아나운서"];
const writes = [],
  reads = [];
await context.route("**/api/backend/**", async (route) => {
  const req = route.request(),
    url = new URL(req.url());
  const reply = (data, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? { result: true, data }
          : {
              result: false,
              code: status === 409 ? "ADMIN_EDIT_CONFLICT" : "FORBIDDEN",
              message: "상태를 확인해 주세요.",
            },
      ),
    });
  if (url.pathname.endsWith("/api/users/me"))
    return reply({
      id: 1,
      email: "fixture@example.invalid",
      nickname: "운영자",
      role: "ADMIN",
      status: "ACTIVE",
      loginProviders: ["LOCAL"],
      onboardingCompleted: true,
      createdAt: "2026-11-07T00:00:00Z",
      membershipType: "admin",
    });
  if (url.pathname.endsWith("/admin/me"))
    return denied
      ? reply(null, 403)
      : reply({ id: 1, nickname: "운영자", role: "ADMIN" });
  if (url.pathname.endsWith("/title-exam-policies"))
    return reply({
      items: multiplePolicies
        ? ranks.map((targetRank, index) => ({
            ...policy,
            targetRank,
            targetTitle: titles[index],
            available: true,
            practiceContentId: 10,
            content: content(10),
          }))
        : [policy],
    });
  if (url.pathname.endsWith("/title-exam-policies/BEGINNER")) {
    writes.push(req.postDataJSON());
    if (conflict) return reply(null, 409);
    const body = req.postDataJSON();
    policy = {
      ...policy,
      version: policy.version + 1,
      practiceContentId: body.practiceContentId,
      passingScore: body.passingScore,
      content: content(body.practiceContentId),
    };
    return reply(policy);
  }
  if (url.pathname.endsWith("/admin/contents")) {
    reads.push(Object.fromEntries(url.searchParams));
    const items = empty ? [] : [content(10), content(20)];
    return reply({
      items,
      page: 0,
      size: 10,
      totalElements: items.length,
      totalPages: items.length ? 1 : 0,
      hasNext: false,
    });
  }
  return reply({});
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(base + "/admin/title-exams");
  await page
    .getByRole("heading", { name: "승급 시험 관리", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "승급 시험 관리", exact: true })
      .count(),
    1,
  );
  await page.getByRole("button", { name: "설정 변경", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "새 시험" })
    .getByRole("button", { name: "이 문장 선택" })
    .click();
  await page.getByLabel("합격 점수", { exact: true }).fill("80");
  await page.getByLabel("작업 사유", { exact: true }).fill("검수 후 시험 교체");
  await mkdir("test-artifacts/admin-ui", { recursive: true });
  await page.screenshot({
    path: "test-artifacts/admin-ui/title-exam-editor.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "시험 설정 저장", exact: true })
    .click();
  await page.getByText("변경사항을 저장했습니다.").waitFor();
  assert.deepEqual(writes[0], {
    practiceContentId: 20,
    contentVersion: 2,
    passingScore: 80,
    version: 0,
    reason: "검수 후 시험 교체",
  });
  assert.equal(reads[0].category, "TITLE_EXAM");
  assert.equal(reads[0].status, "PUBLISHED");
  assert.equal(reads[0].type, "SENTENCE");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "설정 변경", exact: true }).click();
  conflict = true;
  await page.getByLabel("작업 사유", { exact: true }).fill("충돌 시 입력 보존");
  await page
    .getByRole("button", { name: "시험 설정 저장", exact: true })
    .click();
  await page.getByText(/다른 관리자가 수정했거나/).waitFor();
  assert.equal(
    await page.getByLabel("작업 사유", { exact: true }).inputValue(),
    "충돌 시 입력 보존",
  );
  assert.equal(writes.length, 2);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  empty = true;
  policy = {
    ...policy,
    available: false,
    content: null,
    practiceContentId: null,
  };
  await page.reload();
  await page.getByText(/현재 문제는 시험에 사용할 수 없습니다/).waitFor();
  await page.getByRole("button", { name: "설정 변경", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "시험 설정 저장", exact: true })
      .isDisabled(),
    true,
  );
  denied = true;
  await page.reload();
  await page
    .getByRole("heading", { name: "관리자 접근을 확인해 주세요" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "시험 설정 저장", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  denied = false;
  conflict = false;
  empty = false;
  multiplePolicies = true;
  await page.setViewportSize({ width: 400, height: 811 });
  await page.reload();
  await page
    .getByRole("button", { name: "설정 변경", exact: true })
    .first()
    .waitFor();
  for (const index of [0, 3]) {
    await page
      .getByRole("button", { name: "설정 변경", exact: true })
      .nth(index)
      .click();
    const heading = page.getByRole("heading", {
      name: `${titles[index]} 시험 설정 변경`,
      exact: true,
    });
    await heading.waitFor();
    // DOM visibility alone misses a form appended below all four cards.
    await page.waitForFunction(
      (title) => {
        const heading = [...document.querySelectorAll("h2")].find(
          (item) => item.textContent === title,
        );
        if (!heading) return false;
        const rect = heading.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      },
      `${titles[index]} 시험 설정 변경`,
      { timeout: 3000 },
    );
    const editor = page.getByRole("region", {
      name: `${titles[index]} 시험 설정 변경`,
      exact: true,
    });
    assert.equal(
      await editor.evaluate(
        (element) =>
          element === document.activeElement ||
          element.contains(document.activeElement),
      ),
      true,
    );
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await page.waitForFunction(
      (id) => document.activeElement?.id === id,
      `edit-title-exam-${ranks[index]}`,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "설정 변경", exact: true })
        .nth(index)
        .evaluate((element) => element === document.activeElement),
      true,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: navigation, selection/preview, versioned save, conflict preservation, unavailable/empty, access denial, mobile four-policy editor visibility/focus/return (8 scenarios)",
  );
} finally {
  await browser.close();
}
