import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
const base = process.env.ADMIN_TEST_BASE_URL || "http://127.0.0.1:3100";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Admin UI tests may run against localhost only.");
const output = fileURLToPath(
  new URL("../test-artifacts/admin-ui/", import.meta.url),
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ADMIN_BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.ADMIN_BROWSER_EXECUTABLE_PATH }
    : {}),
});
const now = "2026-11-02T00:00:00Z";
const users = [
  {
    id: 30,
    nickname: "연습 회원",
    maskedEmail: "t***@example.invalid",
    status: "ACTIVE",
    role: "USER",
    createdAt: now,
    membershipType: "free",
    membershipExpiresAt: null,
    membershipEnvironment: null,
    loginProviders: ["LOCAL"],
  },
  {
    id: 31,
    nickname: "발음 연습생",
    maskedEmail: "v***@example.invalid",
    status: "ACTIVE",
    role: "USER",
    createdAt: now,
    membershipType: "paid",
    membershipExpiresAt: "2026-12-02T00:00:00Z",
    membershipEnvironment: "TEST",
    loginProviders: ["LOCAL"],
  },
  {
    id: 9001,
    nickname: "운영 관리자",
    maskedEmail: "a***@example.invalid",
    status: "ACTIVE",
    role: "ADMIN",
    createdAt: now,
    membershipType: "admin",
    membershipExpiresAt: null,
    membershipEnvironment: "TEST",
    loginProviders: ["LOCAL"],
  },
];
const contents = [
  {
    id: 279,
    version: 1,
    type: "ANNOUNCER",
    focus: "PRONUNCIATION",
    category: "ANNOUNCER_PRACTICE",
    difficulty: "BEGINNER",
    title: "아나운서 따라 읽기",
    description: "정확한 발음을 연습합니다.",
    scriptText: "오늘 아침 서울의 날씨를 전해 드립니다.",
    targetPronunciations: [],
    estimatedSeconds: 15,
    status: "PUBLISHED",
    publishedAt: now,
    updatedAt: now,
  },
  {
    id: 304,
    version: 0,
    type: "SENTENCE",
    focus: "PRONUNCIATION",
    category: "FINAL_CONSONANT",
    difficulty: "BEGINNER",
    title: "받침 발음 연습",
    description: "받침을 빠뜨리지 않고 읽습니다.",
    scriptText: "밤이 되면 따뜻한 밥을 먹습니다.",
    targetPronunciations: ["밤", "밥"],
    estimatedSeconds: 8,
    status: "DRAFT",
    publishedAt: null,
    updatedAt: now,
  },
];
const notices = [
  {
    id: 1,
    version: 0,
    title: "서비스 이용 안내",
    summary: "처음 이용하는 회원을 위한 안내입니다.",
    sections: [
      { title: "이용 방법", paragraphs: ["매일 문장 하나로 연습해 보세요."] },
    ],
    pinned: true,
    published: true,
    publishedAt: now,
  },
];
const inquiries = [
  {
    id: 48,
    version: 0,
    userId: 30,
    category: "SERVICE",
    subject: "녹음 이용 방법 문의",
    body: "녹음을 다시 진행하려면 어떻게 해야 하나요?",
    relatedSessionId: 123,
    replyEmail: null,
    status: "RECEIVED",
    answer: null,
    createdAt: now,
    answeredAt: null,
  },
];
const campaigns = [
  {
    id: 11,
    version: 0,
    audience: "ALL_ACTIVE",
    kind: "GENERAL",
    title: "서비스 점검 안내",
    body: "점검 시간 동안 일부 기능 이용이 제한됩니다.",
    deepLink: "/notifications",
    userIds: [],
    status: "DRAFT",
    audienceCount: 3,
    sentCount: 0,
    createdAt: now,
    sentAt: null,
  },
];
const popups = [
  {
    id: 1,
    version: 0,
    title: "함께 시작하는 발음 연습",
    body: "매일 한 문장씩 차근차근 연습해 보세요.",
    deepLink: "/home",
    priority: 10,
    startsAt: now,
    endsAt: "2026-11-05T00:00:00Z",
    enabled: true,
    createdAt: now,
  },
];
const audios = [
  {
    audioId: 64,
    contentId: 279,
    speakerName: "전문 아나운서",
    speakerType: "ANNOUNCER",
    durationMs: 12000,
    primary: true,
    contentVersion: 1,
    createdAt: now,
  },
];
const audits = [
  {
    id: 1,
    actorId: 9001,
    action: "CONTENT_CREATE",
    targetType: "CONTENT",
    targetId: "304",
    reason: "신규 연습 문장 등록",
    changedFields: "title,scriptText",
    outcome: "SUCCESS",
    correlationId: "532fe9f8-14e4-47ce-a011-7c9d5f6a2acd",
    createdAt: now,
  },
];
const resources = [
  "TRAINING_SESSIONS",
  "RECORDINGS",
  "ANALYSES",
  "PAYMENTS",
  "CANCELLATIONS",
  "INQUIRIES",
  "NOTIFICATIONS",
  "COURSE_PROGRESS",
  "TITLES",
  "TITLE_EXAMS",
  "DIRECT_ANALYSES",
  "COACHING_USAGE",
  "PRIVATE_CONTENTS",
  "ONBOARDING",
  "SCRIPT_LIBRARY",
  "NOTIFICATION_SETTINGS",
  "PROCESSING_CONSENTS",
  "MEMBERSHIP_GRANTS",
  "PROFILE_IMAGES",
  "ANALYSIS_SEGMENTS",
];
let holdAccess = false,
  accessStarted,
  releaseAccess;
let allow = true,
  dispatches = 0,
  puts = 0,
  rejectEdit = false,
  rejectDelete = false,
  rejectMemberDeletion = false,
  rejectNoticeDelete = false,
  rejectCampaignEdit = false,
  rejectDraftDelete = false;
const deletedMembers = new Set();
let disposableContentId;
const writes = [];
const reads = [];
let includeWithdrawn = false,
  holdOverview = false,
  releaseOverview,
  overviewBlocked;
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  locale: "ko-KR",
});
await context.addInitScript(() =>
  localStorage.setItem("speakai.access-token", "ui-test-token-only"),
);
function envelope(data) {
  return { result: true, message: "UI contract fixture", data };
}
function paged(items, query) {
  const page = Number(query.get("page") || 0),
    size = Number(query.get("size") || 20);
  return {
    items: items.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
    hasNext: (page + 1) * size < items.length,
  };
}
await context.route("https://storage.example.invalid/**", async (route) => {
  const request = route.request();
  if (request.method() === "OPTIONS") {
    await route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "PUT",
        "access-control-allow-headers": "*",
      },
    });
    return;
  }
  assert.equal(request.headers().authorization, undefined);
  assert.equal(request.headers().cookie, undefined);
  if (request.method() === "GET") {
    const wav = Buffer.alloc(44 + 32000);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24);
    wav.writeUInt32LE(32000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(32000, 40);
    return route.fulfill({
      status: 200,
      contentType: "audio/wav",
      headers: { "access-control-allow-origin": "*" },
      body: wav,
    });
  }
  puts++;
  await route.fulfill({
    status: 200,
    headers: { "access-control-allow-origin": "*" },
  });
});
let rejectPopupImage = false;
const popupPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4z8AAAAASUVORK5CYII=",
  "base64",
);
await context.route("https://images.example.invalid/**", (route) =>
  route.fulfill({ contentType: "image/png", body: popupPng }),
);
await context.route("**/api/backend/**", async (route) => {
  const req = route.request(),
    url = new URL(req.url());
  const path = url.pathname.replace("/api/backend/api/admin", "");
  const method = req.method();
  if (method === "GET") reads.push({ path, query: url.search });
  const imageUpload = method === "POST" && /^\/popups\/\d+\/image$/.test(path);
  const body =
    method === "GET" ? null : imageUpload ? null : req.postDataJSON();
  const reply = (data) =>
    route.fulfill({
      status:
        method === "POST" &&
        !path.endsWith("/dispatch") &&
        !path.endsWith("/withdrawal")
          ? 201
          : 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(data)),
    });
  if (url.pathname === "/api/backend/api/users/me")
    return reply({
      ...users[2],
      email: "admin@example.invalid",
      profileImageUrl: null,
      onboardingCompleted: true,
    });
  if (url.pathname === "/api/backend/api/users/me/notification-preferences")
    return reply({
      practiceReminder: {
        enabled: false,
        time: "09:00",
        daysOfWeek: [],
        timezone: "Asia/Seoul",
      },
      marketing: { enabled: false },
      updatedAt: now,
    });
  if (path === "/me") {
    if (holdAccess)
      await new Promise((resolve) => {
        releaseAccess = resolve;
        accessStarted?.();
      });
    if (!allow) {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          result: false,
          message: "ACCESS_DENIED",
          data: null,
          code: "ACCESS_DENIED",
        }),
      });
      return;
    }
    return reply({ id: 9001, nickname: "운영 관리자", role: "ADMIN" });
  }
  if (!allow) {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ result: false, message: "denied", data: null }),
    });
    return;
  }
  if (method !== "GET") writes.push({ path, method, body });
  if (/^\/popups\/\d+\/image$/.test(path)) {
    if (rejectPopupImage) {
      rejectPopupImage = false;
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          result: false,
          code: "ADMIN_EDIT_CONFLICT",
          message: "conflict",
        }),
      });
    }
    const popup = popups.find((p) => p.id === Number(path.split("/")[2]));
    if (imageUpload) {
      assert.ok(
        req
          .headers()
          ["content-type"].startsWith("multipart/form-data; boundary="),
      );
      assert.ok(req.postDataBuffer().includes(Buffer.from('name="file"')));
      popup.image = {
        id: "00000000-0000-4000-8000-000000000001",
        url: "https://images.example.invalid/popup.png",
        expiresAt: popup.endsAt,
      };
    } else popup.image = null;
    popup.version++;
    return reply(popup);
  }
  if (rejectEdit && method === "PATCH" && path === "/contents/304") {
    rejectEdit = false;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        result: false,
        message: "conflict",
        code: "ADMIN_EDIT_CONFLICT",
        data: null,
      }),
    });
    return;
  }

  const fail = (status, code = "ADMIN_EDIT_CONFLICT") =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        result: false,
        message: "changed",
        code,
        data: null,
      }),
    });
  if (
    method === "DELETE" &&
    path.startsWith("/notices/") &&
    rejectNoticeDelete
  ) {
    rejectNoticeDelete = false;
    return fail(409);
  }
  if (
    method === "PATCH" &&
    path.startsWith("/notification-campaigns/") &&
    rejectCampaignEdit
  ) {
    rejectCampaignEdit = false;
    return fail(409);
  }
  if (
    method === "DELETE" &&
    path.startsWith("/notification-campaigns/") &&
    rejectDraftDelete
  ) {
    rejectDraftDelete = false;
    return fail(504, "UPSTREAM_TIMEOUT");
  }
  if (method === "DELETE" && /^\/reference-audios\/\d+$/.test(path)) {
    const index = audios.findIndex(
      (audio) => audio.audioId === Number(path.split("/")[2]),
    );
    if (index < 0) return fail(404, "RESOURCE_NOT_FOUND");
    assert.equal(body.version, contents[0].version);
    assert.ok(body.reason.trim());
    const [removed] = audios.splice(index, 1);
    contents[0].version++;
    if (removed.primary && audios.length) audios[0].primary = true;
    for (const audio of audios) audio.contentVersion = contents[0].version;
    return reply({ items: audios, contentVersion: contents[0].version });
  }
  if (path === "/users")
    return reply(
      paged(
        [
          ...users.filter(
            (user) =>
              !deletedMembers.has(user.id) &&
              (!url.searchParams.get("keyword") ||
                user.nickname.includes(url.searchParams.get("keyword"))) &&
              (!url.searchParams.get("status") ||
                user.status === url.searchParams.get("status")) &&
              (!url.searchParams.get("role") ||
                user.role === url.searchParams.get("role")),
          ),
          ...(includeWithdrawn
            ? [
                {
                  ...users[0],
                  id: 32,
                  nickname: "탈퇴 확인 회원",
                  status: "WITHDRAWN",
                },
              ]
            : []),
        ],
        url.searchParams,
      ),
    );
  if (/^\/users\/\d+\/overview$/.test(path)) {
    if (holdOverview)
      await new Promise((resolve) => {
        releaseOverview = resolve;
        overviewBlocked?.();
      });
    const member = users.find((user) => user.id === Number(path.split("/")[2]));
    return reply({
      user: member,
      counts: resources.map((resource) => ({
        resource,
        count: resource === "ANALYSES" ? 1 : 0,
      })),
      coachingUsage:
        member.status === "WITHDRAWN"
          ? null
          : {
              membershipType: member.membershipType,
              environment: null,
              unlimited: false,
              startsAt: now,
              expiresAt: "2026-12-02T00:00:00Z",
              limit: 8,
              used: 1,
              reserved: 0,
              remaining: 7,
              canRequestCoaching: true,
            },
      usageUnavailableReason:
        member.status === "WITHDRAWN" ? "ACCOUNT_INACTIVE" : null,
      account: {
        email: member.status === "WITHDRAWN" ? null : "member@example.invalid",
        lastLoginAt: now,
        updatedAt: now,
        withdrawnAt: member.status === "WITHDRAWN" ? now : null,
        termsAgreedAt: now,
        privacyAgreedAt: now,
        loginConnections:
          member.status === "WITHDRAWN"
            ? []
            : [
                {
                  provider: "KAKAO",
                  email: "social@example.invalid",
                  connectedAt: now,
                },
              ],
      },
    });
  }
  if (method === "PATCH" && /^\/users\/\d+\/role$/.test(path)) {
    const member = users.find((user) => user.id === Number(path.split("/")[2]));
    assert.equal(body.expectedRole, member.role);
    assert.ok(body.reason.trim());
    member.role = body.role;
    return reply({ userId: member.id, role: member.role });
  }
  if (method === "DELETE" && /^\/users\/\d+$/.test(path)) {
    const member = users.find((user) => user.id === Number(path.split("/")[2]));
    if (rejectMemberDeletion)
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          result: false,
          message: "changed",
          code: "ADMIN_EDIT_CONFLICT",
          data: null,
        }),
      });
    assert.equal(body.confirmationUserId, undefined);
    assert.equal(body.expectedUpdatedAt, now);
    assert.ok(body.reason.trim());
    const alreadyDeleted = deletedMembers.has(member.id);
    deletedMembers.add(member.id);
    return reply({ userId: member.id, deletedAt: now, alreadyDeleted });
  }
  if (/^\/users\/\d+\/records$/.test(path))
    return reply(
      paged(
        url.searchParams.get("resource") === "ANALYSES"
          ? [
              {
                fields: {
                  id: 96,
                  recordingId: 126,
                  status: "FAILED",
                  failureCode: "execution_failed",
                  requestId: "532fe9f8-14e4-47ce-a011-7c9d5f6a2acd",
                },
              },
            ]
          : [],
        url.searchParams,
      ),
    );
  if (path === "/content-categories")
    return reply([
      {
        type: url.searchParams.get("type"),
        code:
          url.searchParams.get("type") === "ANNOUNCER"
            ? "ANNOUNCER_PRACTICE"
            : "FINAL_CONSONANT",
        label:
          url.searchParams.get("type") === "ANNOUNCER"
            ? "아나운서 연습"
            : "받침",
        sortOrder: 1,
      },
    ]);
  if (path === "/contents") {
    if (method === "POST") {
      const item = {
        ...body.content,
        id: 400 + contents.length,
        version: 0,
        status: "DRAFT",
        publishedAt: null,
        updatedAt: now,
      };
      contents.push(item);
      return reply(item);
    }
    const type = url.searchParams.get("type");
    return reply(
      paged(
        type ? contents.filter((c) => c.type === type) : contents,
        url.searchParams,
      ),
    );
  }
  if (/\/reference-audios\/upload-url$/.test(path))
    return reply({
      uploadId: "test-upload",
      uploadUrl: "https://storage.example.invalid/signed",
      requiredHeaders: { "content-type": "audio/mpeg" },
      expiresAt: "2099-01-01T00:00:00Z",
    });
  if (/\/contents\/\d+\/reference-audios$/.test(path)) {
    if (method === "POST") {
      const audio = {
        audioId: 65,
        contentId: 279,
        speakerName: body.speakerName,
        speakerType: "ANNOUNCER",
        durationMs: 3000,
        primary: body.primary,
        contentVersion: 2,
        createdAt: now,
      };
      audios.forEach((a) => (a.primary = false));
      audios.push(audio);
      contents[0].version = 2;
      return reply(audio);
    }
    return reply({ items: audios, contentVersion: contents[0].version });
  }
  if (/\/reference-audios\/\d+\/playback-url$/.test(path))
    return reply({
      audioId: Number(path.split("/")[2]),
      playbackUrl: "https://storage.example.invalid/playback",
      expiresAt: "2099-01-01T00:00:00Z",
    });
  if (/\/contents\/\d+\/publication$/.test(path)) {
    const id = Number(path.split("/")[2]);
    const item = contents.find((c) => c.id === id);
    item.status = body.status;
    item.publishedAt = now;
    item.version++;
    return reply(item);
  }
  if (/^\/contents\/\d+$/.test(path)) {
    const index = contents.findIndex(
      (c) => c.id === Number(path.split("/")[2]),
    );
    const item = contents[index];
    if (!item)
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ result: false, message: "missing", data: null }),
      });
    if (method === "DELETE") {
      if (rejectDelete)
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            result: false,
            message: "changed",
            code: "ADMIN_EDIT_CONFLICT",
            data: null,
          }),
        });
      assert.equal(body.version, item.version);
      assert.ok(body.reason.trim());
      contents.splice(index, 1);
      return reply({ id: item.id, version: item.version + 1, deletedAt: now });
    }
    if (method === "PATCH") {
      assert.equal(body.version, item.version);
      Object.assign(item, body.content, { version: item.version + 1 });
    }
    return reply(item);
  }
  if (path === "/notices") {
    if (method === "POST") {
      const item = { ...body.notice, id: notices.length + 1, version: 0 };
      notices.push(item);
      return reply(item);
    }
    return reply(paged(notices, url.searchParams));
  }
  if (/^\/notices\/\d+$/.test(path)) {
    const index = notices.findIndex((n) => n.id === Number(path.split("/")[2]));
    if (index < 0) return fail(404, "RESOURCE_NOT_FOUND");
    if (method === "DELETE") {
      assert.equal(body.version, notices[index].version);
      assert.ok(body.reason.trim());
      notices.splice(index, 1);
      return reply(null);
    }
    return reply(notices[index]);
  }
  if (path === "/inquiries")
    return reply(
      paged(
        url.searchParams.get("status")
          ? inquiries.filter(
              (item) => item.status === url.searchParams.get("status"),
            )
          : inquiries,
        url.searchParams,
      ),
    );
  if (/^\/inquiries\/\d+\/(answer|status)$/.test(path)) {
    const item = inquiries[0];
    if (path.endsWith("/answer"))
      Object.assign(item, {
        answer: body.answer,
        status: "ANSWERED",
        answeredAt: now,
      });
    else item.status = body.status;
    item.version++;
    return reply(item);
  }
  if (/^\/inquiries\/\d+$/.test(path)) return reply(inquiries[0]);
  if (path === "/notification-campaigns") {
    if (method === "POST") {
      const item = {
        ...body,
        id: campaigns.length + 20,
        version: 0,
        status: "DRAFT",
        audienceCount: body.userIds.length || 3,
        sentCount: 0,
        createdAt: now,
        sentAt: null,
      };
      campaigns.push(item);
      return reply(item);
    }
    return reply(paged(campaigns, url.searchParams));
  }
  if (/\/notification-campaigns\/\d+\/dispatch$/.test(path)) {
    const c = campaigns.find((c) => c.id === Number(path.split("/")[2]));
    if (c.status === "DRAFT") {
      dispatches++;
      c.status = "SENT";
      c.sentCount = c.audienceCount;
      c.sentAt = now;
      c.version++;
    }
    return reply(c);
  }
  if (/^\/notification-campaigns\/\d+$/.test(path)) {
    const index = campaigns.findIndex(
      (c) => c.id === Number(path.split("/")[2]),
    );
    if (index < 0) return fail(404, "RESOURCE_NOT_FOUND");
    const item = campaigns[index];
    if (method !== "GET") {
      if (item.status !== "DRAFT" || body.version !== item.version)
        return fail(409);
      assert.ok(body.reason.trim());
      if (method === "DELETE") {
        campaigns.splice(index, 1);
        return reply(null);
      }
      assert.equal(method, "PATCH");
      Object.assign(item, body, {
        version: item.version + 1,
        audienceCount: body.userIds.length || 3,
      });
    }
    return reply(item);
  }
  if (path === "/popups") {
    if (method === "POST") {
      const item = {
        ...body.popup,
        id: popups.length + 1,
        version: 0,
        createdAt: now,
        endsAt: new Date(
          Date.parse(body.popup.startsAt) + body.popup.durationDays * 86400000,
        ).toISOString(),
      };
      popups.push(item);
      return reply(item);
    }
    return reply(paged(popups, url.searchParams));
  }
  if (/^\/popups\/\d+$/.test(path))
    return reply(popups.find((p) => p.id === Number(path.split("/")[2])));
  if (path === "/courses" && method === "GET")
    return reply(paged([], url.searchParams));
  if (path === "/audit-logs") return reply(paged(audits, url.searchParams));
  throw new Error(`Unhandled fixture request ${method} ${path}`);
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
const heading = (title) =>
  page.getByRole("heading", { name: title, exact: true }).waitFor();
const nav = (title) =>
  page
    .getByRole("navigation", { name: "관리자 메뉴" })
    .getByRole("link", { name: title, exact: true });
const results = [];
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log("PASS", name);
}
try {
  await check("desktop dashboard and real count layout", async () => {
    await page.goto(base + "/admin");
    await heading("운영 현황");
    await page.getByText("답변을 기다리는 문의", { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(output, "admin-overview.png"),
      fullPage: true,
    });
  });
  await check("all admin menus render without browser errors", async () => {
    for (const title of [
      "회원 관리",
      "학습 콘텐츠",
      "아나운서 음성",
      "공지사항",
      "문의 관리",
      "알림 발송",
      "팝업 관리",
      "작업 이력",
    ]) {
      await nav(title).click();
      await heading(title);
    }
  });
  await check(
    "member detail uses Korean record names without evaluation lookup",
    async () => {
      await nav("회원 관리").click();
      await page.getByRole("link", { name: "연습 회원", exact: true }).click();
      await heading("연습 회원님의 기록");
      await page.getByRole("button", { name: /^음성 평가/ }).click();
      await page
        .getByText("음성 평가를 완료하지 못했습니다", { exact: true })
        .waitFor();
      await page
        .getByRole("columnheader", { name: "녹음 번호", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("columnheader", { name: "recordingId", exact: true })
          .count(),
        0,
      );
      await page.getByText("social@example.invalid", { exact: true }).waitFor();
      assert.equal(
        await page.getByText("execution_failed", { exact: true }).count(),
        0,
      );
      await nav("회원 관리").click();
      assert.equal(
        await page
          .getByText("평가 조회 번호로 회원 찾기", { exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "연결된 회원 조회", exact: true })
          .count(),
        0,
      );
      assert.equal(reads.filter((r) => r.path === "/users/resolve").length, 0);
    },
  );
  await check(
    "retired members remain hidden and the withdrawn filter is absent",
    async () => {
      await nav("회원 관리").click();
      await page
        .getByRole("link", { name: "연습 회원", exact: true })
        .waitFor();
      includeWithdrawn = true;
      const refreshed = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith("/api/admin/users") &&
          r.status() === 200,
      );
      await page.getByRole("button", { name: "새로고침", exact: true }).click();
      await refreshed;
      assert.equal(
        await page
          .getByRole("link", { name: "탈퇴 확인 회원", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByLabel("회원 상태", { exact: true })
          .locator('option[value="WITHDRAWN"]')
          .count(),
        0,
      );
      includeWithdrawn = false;
    },
  );
  await check(
    "readonly list navigation reuses data but still rechecks administrator access",
    async () => {
      await nav("학습 콘텐츠").click();
      await page
        .getByRole("link", { name: contents[0].title, exact: true })
        .first()
        .waitFor();
      const before = reads.filter((r) => r.path === "/contents").length;
      const beforeAccess = reads.filter((r) => r.path === "/me").length;
      await nav("회원 관리").click();
      await heading("회원 관리");
      await nav("학습 콘텐츠").click();
      await page
        .getByRole("link", { name: contents[0].title, exact: true })
        .first()
        .waitFor();
      assert.equal(reads.filter((r) => r.path === "/contents").length, before);
      assert.ok(
        reads.filter((r) => r.path === "/me").length >= beforeAccess + 2,
      );
    },
  );
  await check(
    "same-session navigation keeps the page and input visible during delayed authorization",
    async () => {
      holdAccess = true;
      const pending = new Promise((resolve) => {
        accessStarted = resolve;
      });
      try {
        await nav("회원 관리").click();
        await pending;
        await heading("회원 관리");
        assert.equal(
          await page
            .getByRole("heading", { name: "관리자 권한 확인 중", exact: true })
            .count(),
          0,
        );
        await page
          .getByLabel("이름 검색", { exact: true })
          .fill("대기 중 입력");
        assert.equal(
          await page.getByRole("navigation", { name: "관리자 메뉴" }).count(),
          1,
        );
        const completed = page.waitForResponse(
          (r) => r.url().endsWith("/api/admin/me") && r.status() === 200,
        );
        holdAccess = false;
        releaseAccess();
        await completed;
        assert.equal(
          await page.getByLabel("이름 검색", { exact: true }).inputValue(),
          "대기 중 입력",
        );
        await page.getByLabel("이름 검색", { exact: true }).fill("");
      } finally {
        holdAccess = false;
        accessStarted = undefined;
        releaseAccess?.();
      }
    },
  );
  await check(
    "member name search encodes the nickname, handles empty results and restores the full list",
    async () => {
      const search = page.getByLabel("이름 검색", { exact: true });
      await search.fill("  발음 연습생  ");
      const loaded = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith("/api/admin/users") &&
          new URL(r.url()).searchParams.get("keyword") === "발음 연습생",
      );
      await search.press("Enter");
      await loaded;
      await page
        .getByRole("link", { name: "발음 연습생", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: "연습 회원", exact: true })
          .count(),
        0,
      );
      await search.fill("없는 회원");
      await search.press("Enter");
      await page
        .getByRole("link", { name: "발음 연습생", exact: true })
        .waitFor({ state: "detached" });
      await search.fill("");
      await search.press("Enter");
      await page
        .getByRole("link", { name: "연습 회원", exact: true })
        .waitFor();
      assert.equal(reads.filter((r) => r.path === "/users/resolve").length, 0);
      await page.screenshot({
        path: path.join(output, "admin-member-name-search.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "background navigation denial immediately hides the previously approved console",
    async () => {
      allow = false;
      await nav("학습 콘텐츠").click();
      await heading("관리자 접근을 확인해 주세요");
      assert.equal(
        await page.getByRole("navigation", { name: "관리자 메뉴" }).count(),
        0,
      );
      assert.equal(
        await page.getByLabel("이름 검색", { exact: true }).count(),
        0,
      );
      allow = true;
      await page.goto(base + "/admin");
      await heading("운영 현황");
    },
  );
  await check(
    "member records do not wait for the twenty-resource overview",
    async () => {
      holdOverview = true;
      const blocked = new Promise((resolve) => {
        overviewBlocked = resolve;
      });
      const recorded = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith("/users/30/records") &&
          r.status() === 200,
        { timeout: 15_000 },
      );
      try {
        await page.goto(base + "/admin/users/30");
        await Promise.all([blocked, recorded]);
      } finally {
        holdOverview = false;
        releaseOverview?.();
        overviewBlocked = undefined;
      }
      await heading("연습 회원님의 기록");
      await nav("학습 콘텐츠").click();
      await heading("학습 콘텐츠");
    },
  );
  await check("content draft creation and explicit publication", async () => {
    await nav("학습 콘텐츠").click();
    await page.getByRole("link", { name: "새 콘텐츠", exact: true }).click();
    await page
      .getByLabel("카테고리", { exact: true })
      .selectOption("FINAL_CONSONANT");
    await page
      .getByLabel("콘텐츠 제목", { exact: true })
      .fill("브라우저 검증 문장");
    await page
      .getByLabel("연습할 문장·원문", { exact: true })
      .fill("밤이 되면 따뜻한 밥을 먹습니다.");
    await page.getByLabel("작업 사유", { exact: true }).fill("브라우저 검증");
    await page.getByRole("button", { name: "초안 등록", exact: true }).click();
    await page.waitForURL(/\/admin\/contents\/\d+$/);
    await page.getByRole("button", { name: "공개하기", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("작업 사유", { exact: true })
      .fill("문장 검수 완료");
    await dialog.getByRole("button", { name: "공개하기", exact: true }).click();
    await page.getByRole("button", { name: "숨기기", exact: true }).waitFor();
    await heading("콘텐츠 편집");
    disposableContentId = Number(
      new URL(page.url()).pathname.split("/").at(-1),
    );
  });
  await check(
    "published and hidden content remains editable in place",
    async () => {
      await page
        .getByLabel("콘텐츠 제목", { exact: true })
        .fill("공개 후 수정한 문장");
      await page.getByLabel("작업 사유", { exact: true }).fill("공개 후 교정");
      await page
        .getByRole("button", { name: "변경사항 저장", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "공개 후 수정한 문장", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "숨기기", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("작업 사유", { exact: true }).fill("숨김 검수");
      await dialog.getByRole("button", { name: "숨기기", exact: true }).click();
      await page
        .getByRole("button", { name: "공개하기", exact: true })
        .waitFor();
      await page
        .getByLabel("콘텐츠 제목", { exact: true })
        .fill("숨김 후 수정한 문장");
      await page.getByLabel("작업 사유", { exact: true }).fill("숨김 교정");
      await page
        .getByRole("button", { name: "변경사항 저장", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "숨김 후 수정한 문장", exact: true })
        .waitFor();
      assert.ok(page.url().endsWith(`/contents/${disposableContentId}`));
    },
  );
  await check(
    "editing conflict keeps the unsaved form and existing category",
    async () => {
      await page.goto(base + "/admin/contents/304");
      await page
        .getByRole("heading", { name: "콘텐츠 상세", exact: true })
        .waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector('select[name="category"]')?.value ===
          "FINAL_CONSONANT",
      );
      assert.equal(
        await page.getByLabel("카테고리", { exact: true }).inputValue(),
        "FINAL_CONSONANT",
      );
      await page
        .getByLabel("콘텐츠 제목", { exact: true })
        .fill("보존할 수정 제목");
      await page
        .getByLabel("작업 사유", { exact: true })
        .fill("동시 수정 검증");
      rejectEdit = true;
      await page
        .getByRole("button", { name: "변경사항 저장", exact: true })
        .click();
      await page
        .getByText("다른 관리자가 수정했거나 상태가 변경되었습니다.", {
          exact: false,
        })
        .waitFor();
      assert.equal(
        await page.getByLabel("콘텐츠 제목", { exact: true }).inputValue(),
        "보존할 수정 제목",
      );
    },
  );
  await check(
    "announcer audio upload uses private PUT and connects registration",
    async () => {
      await nav("아나운서 음성").click();
      await page
        .getByRole("link", { name: "아나운서 따라 읽기", exact: true })
        .click();
      await page.getByLabel("음성 파일", { exact: true }).setInputFiles({
        name: "sample.mp3",
        mimeType: "audio/mpeg",
        buffer: Buffer.from([1, 2, 3, 4]),
      });
      await page
        .getByLabel("화자 표시명", { exact: true })
        .fill("테스트 아나운서");
      await page
        .getByRole("form", { name: "기준 음성 등록" })
        .getByLabel("작업 사유", { exact: true })
        .fill("기준 음성 검수");
      await page
        .getByRole("button", { name: "업로드하고 등록", exact: true })
        .click();
      await page
        .getByText("테스트 아나운서", { exact: false })
        .first()
        .waitFor();
      assert.equal(puts, 1);
      await page.screenshot({
        path: path.join(output, "admin-announcer.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "notification draft never dispatches before reason confirmation",
    async () => {
      await nav("알림 발송").click();
      await page.getByRole("link", { name: "알림 작성", exact: true }).click();
      await page
        .getByLabel("발송 대상", { exact: true })
        .selectOption("SELECTED_USERS");
      await page.getByLabel("회원 번호", { exact: true }).fill("30,31");
      await page
        .getByLabel("알림 제목", { exact: true })
        .fill("UI 검증용 요금제 안내");
      await page
        .getByLabel("알림 본문", { exact: true })
        .fill("요금제를 확인해 주세요.");
      await page.getByLabel("알림 유형", { exact: true }).selectOption("PLAN");
      await page.getByLabel("작업 사유", { exact: true }).fill("초안 검토");
      await page
        .getByRole("button", { name: "초안 저장·검토", exact: true })
        .click();
      await page.waitForURL(/\/admin\/notifications\/\d+$/);
      assert.equal(dispatches, 0);
      await page
        .getByRole("button", { name: "검토 완료·발송하기", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("대상 검토 후 발송");
      await dialog
        .getByRole("button", { name: "검토 완료·발송하기", exact: true })
        .click();
      await page
        .getByText("총 2명에게 전달했습니다.", { exact: false })
        .waitFor();
      assert.equal(dispatches, 1);
    },
  );
  await check(
    "popup duration is sent explicitly and server end date is shown",
    async () => {
      await nav("팝업 관리").click();
      await page.getByRole("link", { name: "팝업 등록", exact: true }).click();
      await page.getByLabel("제목", { exact: true }).fill("기간 팝업 검증");
      await page.getByLabel("본문", { exact: true }).fill("3일간 안내합니다.");
      await page.getByLabel("노출 일수", { exact: true }).fill("3");
      await page.getByLabel("설정한 기간에 팝업 노출", { exact: true }).check();
      await page.getByLabel("작업 사유", { exact: true }).fill("기간 확인");
      await page
        .getByRole("button", { name: "팝업 저장", exact: true })
        .click();
      await page.waitForURL(/\/admin\/popups\/\d+$/);
      await page
        .getByText("현재 저장된 종료 시각:", { exact: false })
        .waitFor();
      assert.equal(
        writes.find((w) => w.path === "/popups").body.popup.durationDays,
        3,
      );
    },
  );
  await check(
    "popup image upload validates files and displays the saved image",
    async () => {
      // Locate controls by unique labels so the settings and image forms cannot be confused.
      const file = page.getByLabel("이미지 파일", { exact: true });
      await file.setInputFiles({
        name: "bad.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg/>"),
      });
      await page
        .getByText("PNG 또는 JPEG 이미지를 3MB 이하로 첨부해 주세요.", {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "이미지 첨부", exact: true })
          .isDisabled(),
        true,
      );
      await file.setInputFiles({
        name: "popup.png",
        mimeType: "image/png",
        buffer: popupPng,
      });
      await page
        .getByLabel("이미지 변경 사유", { exact: true })
        .fill("이미지 첨부");
      await page
        .getByRole("button", { name: "이미지 첨부", exact: true })
        .click();
      await page
        .getByRole("button", { name: "이미지 교체", exact: true })
        .waitFor();
      await page.waitForFunction(() =>
        [...document.images].some(
          (i) => i.alt.includes("기간 팝업 검증") && i.naturalWidth > 0,
        ),
      );
      await page.getByLabel("제목", { exact: true }).fill("저장 전 설정");
      assert.equal(await file.isDisabled(), true);
      await page.reload();
      await file.waitFor();
    },
  );
  await check(
    "popup image conflict preserves file selection and detach retains popup text",
    async () => {
      await page.getByLabel("이미지 파일", { exact: true }).setInputFiles({
        name: "replace.png",
        mimeType: "image/png",
        buffer: popupPng,
      });
      await page
        .getByLabel("이미지 변경 사유", { exact: true })
        .fill("이미지 교체");
      rejectPopupImage = true;
      const before = writes.filter((w) => w.path.endsWith("/image")).length;
      await page
        .getByRole("button", { name: "이미지 교체", exact: true })
        .click();
      await page.getByText(/다른 관리자가 수정했거나/).waitFor();
      assert.equal(
        await page.getByLabel("이미지 변경 사유", { exact: true }).inputValue(),
        "이미지 교체",
      );
      assert.equal(
        writes.filter((w) => w.path.endsWith("/image")).length,
        before + 1,
      );
      await page
        .getByRole("button", { name: "이미지 해제", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("작업 사유", { exact: true }).fill("첨부 해제");
      await dialog
        .getByRole("button", { name: "이미지 해제", exact: true })
        .click();
      await page
        .getByRole("button", { name: "이미지 첨부", exact: true })
        .waitFor();
      assert.equal(
        await page.getByLabel("본문", { exact: true }).inputValue(),
        "3일간 안내합니다.",
      );
    },
  );
  await check("notice sections create a typed plain text notice", async () => {
    await nav("공지사항").click();
    await page.getByRole("link", { name: "새 공지", exact: true }).click();
    await page.getByLabel("제목", { exact: true }).fill("운영 공지 검증");
    await page
      .getByLabel("짧은 요약", { exact: true })
      .fill("문단과 구역을 확인합니다.");
    await page.getByLabel("구역 제목", { exact: true }).fill("이용 안내");
    await page
      .getByLabel("본문", { exact: true })
      .fill("첫 번째 문단입니다.\n두 번째 문단입니다.");
    await page.getByLabel("작업 사유", { exact: true }).fill("공지 검수");
    await page.getByRole("button", { name: "공지 저장", exact: true }).click();
    await page.waitForURL(/\/admin\/notices\/\d+$/);
    const notice = writes.find((w) => w.path === "/notices").body.notice;
    assert.equal(notice.sections[0].paragraphs.length, 2);
    assert.equal(notice.published, false);
  });
  await check(
    "notice delete requires reason, retains a conflict and returns to the refreshed list",
    async () => {
      await page.goto(base + "/admin/notices/1");
      await heading("공지 편집");
      await page
        .getByRole("button", { name: "공지 삭제", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      const before = writes.filter(
        (w) => w.path === "/notices/1" && w.method === "DELETE",
      ).length;
      await dialog
        .getByRole("button", { name: "공지 삭제", exact: true })
        .click();
      assert.equal(
        writes.filter((w) => w.path === "/notices/1" && w.method === "DELETE")
          .length,
        before,
      );
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("지난 공지 정리");
      rejectNoticeDelete = true;
      await dialog
        .getByRole("button", { name: "공지 삭제", exact: true })
        .click();
      await dialog.getByText(/다른 관리자가 수정/).waitFor();
      assert.ok(page.url().endsWith("/admin/notices/1"));
      assert.equal(
        await dialog.getByLabel("작업 사유", { exact: true }).inputValue(),
        "지난 공지 정리",
      );
      await dialog
        .getByRole("button", { name: "공지 삭제", exact: true })
        .click();
      await page.waitForURL(/\/admin\/notices$/);
      await heading("공지사항");
      assert.equal(
        await page
          .getByRole("link", { name: "서비스 이용 안내", exact: true })
          .count(),
        0,
      );
    },
  );
  await check(
    "draft edit preserves input on conflict, updates recipients and sends the new version",
    async () => {
      await page.goto(base + "/admin/notifications/11");
      await heading("알림 검토·발송");
      await page
        .getByRole("button", { name: "초안 수정", exact: true })
        .click();
      await page
        .getByLabel("알림 제목", { exact: true })
        .fill("수정된 서비스 안내");
      await page
        .getByLabel("발송 대상", { exact: true })
        .selectOption("SELECTED_USERS");
      await page.getByLabel("회원 번호", { exact: true }).fill("31");
      await page
        .getByLabel("작업 사유", { exact: true })
        .fill("내용과 대상 정정");
      const sentBefore = dispatches;
      rejectCampaignEdit = true;
      await page
        .getByRole("button", { name: "초안 수정 저장", exact: true })
        .click();
      await page.getByText(/다른 관리자가 수정/).waitFor();
      assert.equal(
        await page.getByLabel("알림 제목", { exact: true }).inputValue(),
        "수정된 서비스 안내",
      );
      assert.equal(dispatches, sentBefore);
      await page
        .getByRole("button", { name: "초안 수정 저장", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "수정된 서비스 안내", exact: true })
        .waitFor();
      assert.deepEqual(campaigns.find((c) => c.id === 11).userIds, [31]);
      assert.equal(dispatches, sentBefore);
      await page
        .getByRole("button", { name: "검토 완료·발송하기", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("수정 내용 확인");
      await dialog
        .getByRole("button", { name: "검토 완료·발송하기", exact: true })
        .click();
      await page
        .getByText("총 1명에게 전달했습니다.", { exact: false })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "초안 수정", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "초안 삭제", exact: true })
          .count(),
        0,
      );
      const sent = writes
        .filter((w) => w.path === "/notification-campaigns/11/dispatch")
        .at(-1);
      assert.equal(sent.body.version, 1);
      await page.screenshot({
        path: path.join(output, "admin-completion-sent.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "draft delete preserves an uncertain outcome and requires manual confirmation again",
    async () => {
      campaigns.push({
        ...campaigns[0],
        id: 91,
        version: 0,
        status: "DRAFT",
        sentAt: null,
        sentCount: 0,
        title: "삭제할 초안",
      });
      await page.goto(base + "/admin/notifications/91");
      await heading("알림 검토·발송");
      await page
        .getByRole("button", { name: "초안 삭제", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("중복 초안 정리");
      rejectDraftDelete = true;
      await dialog
        .getByRole("button", { name: "초안 삭제", exact: true })
        .click();
      await dialog
        .getByText(/서버의 처리 결과를 확인하지 못했습니다/)
        .waitFor();
      assert.ok(page.url().endsWith("/admin/notifications/91"));
      assert.equal(
        writes.filter(
          (w) =>
            w.path === "/notification-campaigns/91" && w.method === "DELETE",
        ).length,
        1,
      );
      await dialog
        .getByRole("button", { name: "돌아가기", exact: true })
        .click();
      await page.reload();
      await heading("알림 검토·발송");
      await page
        .getByRole("button", { name: "초안 삭제", exact: true })
        .click();
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("목록 확인 후 정리");
      await dialog
        .getByRole("button", { name: "초안 삭제", exact: true })
        .click();
      await page.waitForURL(/\/admin\/notifications$/);
      assert.equal(
        campaigns.some((c) => c.id === 91),
        false,
      );
    },
  );
  await check(
    "audio delete clears playback, promotes remaining primary and allows the last deletion",
    async () => {
      await page.goto(base + "/admin/announcer/279");
      await heading("콘텐츠 편집");
      const cards = page
        .locator('[class*="sectionEditor"]')
        .filter({ has: page.getByText("테스트 아나운서", { exact: false }) });
      await cards
        .getByRole("button", { name: "미리듣기", exact: true })
        .click();
      await page.locator("audio").waitFor();
      await cards
        .getByRole("button", { name: "음성 삭제", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("작업 사유", { exact: true }).fill("음성 교체");
      await dialog
        .getByRole("button", { name: "음성 삭제", exact: true })
        .click();
      await page.getByText("전문 아나운서", { exact: false }).first().waitFor();
      await page
        .getByRole("button", { name: "음성 삭제", exact: true })
        .waitFor();
      assert.equal(await page.locator("audio").count(), 0);
      assert.equal(audios.length, 1);
      assert.equal(audios[0].primary, true);
      await page.screenshot({
        path: path.join(output, "admin-completion-audio.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "음성 삭제", exact: true })
        .click();
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("마지막 음성 정리");
      await dialog
        .getByRole("button", { name: "음성 삭제", exact: true })
        .click();
      await page
        .getByRole("button", { name: "음성 삭제", exact: true })
        .waitFor({ state: "detached" });
      assert.equal(audios.length, 0);
      const deletions = writes.filter(
        (w) => /^\/reference-audios\//.test(w.path) && w.method === "DELETE",
      );
      assert.deepEqual(
        deletions.map((w) => w.body.version),
        [2, 3],
      );
    },
  );
  await check(
    "new destructive dialogs and draft editor fit the existing mobile layout",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + "/admin/notices/2");
      await heading("공지 편집");
      await page
        .getByRole("button", { name: "공지 삭제", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("작업 사유", { exact: true }).waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: path.join(output, "admin-completion-mobile-notice.png"),
        fullPage: true,
      });
      await dialog
        .getByRole("button", { name: "돌아가기", exact: true })
        .click();
      campaigns.push({
        ...campaigns[0],
        id: 92,
        version: 0,
        status: "DRAFT",
        sentAt: null,
        sentCount: 0,
        title: "모바일 초안",
      });
      await page.goto(base + "/admin/notifications/92");
      await heading("알림 검토·발송");
      await page
        .getByRole("button", { name: "초안 수정", exact: true })
        .click();
      await page.getByLabel("알림 제목", { exact: true }).waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: path.join(output, "admin-completion-mobile-draft.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "편집 취소", exact: true })
        .click();
      await page.setViewportSize({ width: 1440, height: 1050 });
    },
  );
  await check(
    "one inquiry completion action saves the answer and marks it answered",
    async () => {
      await nav("문의 관리").click();
      await page
        .getByRole("link", { name: "녹음 이용 방법 문의", exact: true })
        .click();
      await page
        .getByLabel("답변 내용", { exact: true })
        .fill("현재 문장에서 다시 녹음을 선택해 주세요.");
      await page.getByLabel("작업 사유", { exact: true }).fill("문의 답변");
      await page
        .getByRole("button", { name: "문의 완료", exact: true })
        .click();
      await page.getByText("변경사항을 저장했습니다.").waitFor();
      assert.equal(inquiries[0].status, "ANSWERED");
      assert.equal(
        await page
          .getByRole("button", { name: "처리 시작", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "답변 저장", exact: true })
          .count(),
        0,
      );
      assert.equal(
        writes.filter((w) => w.path === "/inquiries/1/status").length,
        0,
      );
    },
  );
  await check(
    "member administrator role can be granted and revoked; self change is disabled",
    async () => {
      await page.goto(base + "/admin/users/30");
      await heading("연습 회원님의 기록");
      await page
        .getByRole("button", { name: "관리자 지정", exact: true })
        .click();
      let dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("운영 담당 지정");
      await dialog
        .getByRole("button", { name: "관리자 지정", exact: true })
        .click();
      await page
        .getByRole("button", { name: "관리자 해제", exact: true })
        .waitFor();
      assert.equal(users[0].role, "ADMIN");
      await page
        .getByRole("button", { name: "관리자 해제", exact: true })
        .click();
      dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("운영 담당 해제");
      await dialog
        .getByRole("button", { name: "관리자 해제", exact: true })
        .click();
      await page
        .getByRole("button", { name: "관리자 지정", exact: true })
        .waitFor();
      assert.equal(users[0].role, "USER");
      await page.goto(base + "/admin/users/9001");
      await heading("운영 관리자님의 기록");
      assert.equal(
        await page
          .getByRole("button", { name: "관리자 해제", exact: true })
          .isDisabled(),
        true,
      );
    },
  );
  await check(
    "delete requires confirmation and a conflict preserves the unsaved editor",
    async () => {
      await page.goto(base + `/admin/contents/${disposableContentId}`);
      await heading("콘텐츠 편집");
      await page
        .getByLabel("콘텐츠 제목", { exact: true })
        .fill("아직 저장하지 않은 제목");
      const before = writes.filter((w) => w.method === "DELETE").length;
      await page.getByRole("button", { name: "삭제하기", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("중복 문장 정리");
      assert.equal(writes.filter((w) => w.method === "DELETE").length, before);
      rejectDelete = true;
      await dialog
        .getByRole("button", { name: "삭제하기", exact: true })
        .click();
      await dialog
        .getByText("다른 관리자가 수정했거나 상태가 변경되었습니다.", {
          exact: false,
        })
        .waitFor();
      assert.equal(
        await page.getByLabel("콘텐츠 제목", { exact: true }).inputValue(),
        "아직 저장하지 않은 제목",
      );
      assert.ok(page.url().endsWith(`/contents/${disposableContentId}`));
      assert.equal(
        writes.filter((w) => w.method === "DELETE").length,
        before + 1,
      );
      await dialog
        .getByRole("button", { name: "돌아가기", exact: true })
        .click();
      rejectDelete = false;
    },
  );
  await check(
    "confirmed deletion returns to a refreshed content list",
    async () => {
      await page.getByRole("button", { name: "삭제하기", exact: true }).click();
      const dialog = page.getByRole("dialog");
      assert.equal(
        await dialog
          .getByText("다른 관리자가 수정했거나 상태가 변경되었습니다.", {
            exact: false,
          })
          .count(),
        0,
      );
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("최종 삭제 확인");
      await page.screenshot({
        path: path.join(output, "admin-content-delete.png"),
        fullPage: true,
        animations: "disabled",
      });
      await dialog
        .getByRole("button", { name: "삭제하기", exact: true })
        .click();
      await page.waitForURL(base + "/admin/contents");
      await heading("학습 콘텐츠");
      assert.equal(
        await page.getByText("숨김 후 수정한 문장", { exact: true }).count(),
        0,
      );
      const last = writes.filter((w) => w.method === "DELETE").at(-1);
      assert.equal(last.body.reason, "최종 삭제 확인");
      assert.ok(!contents.some((c) => c.id === disposableContentId));
    },
  );
  await check(
    "member deletion requires only a reason and preserves the screen on a conflict",
    async () => {
      await page.goto(base + "/admin/users/30");
      await heading("연습 회원님의 기록");
      const before = writes.filter(
        (w) => w.method === "DELETE" && w.path === "/users/30",
      ).length;
      await page
        .getByRole("button", { name: "회원 삭제하기", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      assert.equal(
        await dialog.getByLabel("확인할 회원 번호", { exact: true }).count(),
        0,
      );
      await dialog.getByLabel("작업 사유", { exact: true }).fill(" ");
      await dialog
        .getByRole("button", { name: "회원 삭제하기", exact: true })
        .click();
      await dialog
        .getByText("작업 사유 입력이 필요합니다.", { exact: true })
        .waitFor();
      assert.equal(
        writes.filter((w) => w.method === "DELETE" && w.path === "/users/30")
          .length,
        before,
      );
      rejectMemberDeletion = true;
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("회원 요청 확인");
      await dialog
        .getByRole("button", { name: "회원 삭제하기", exact: true })
        .click();
      await dialog
        .getByText("다른 관리자가 수정했거나 상태가 변경되었습니다.", {
          exact: false,
        })
        .waitFor();
      assert.ok(page.url().endsWith("/admin/users/30"));
      assert.equal(
        await dialog.getByLabel("작업 사유", { exact: true }).inputValue(),
        "회원 요청 확인",
      );
      await dialog
        .getByRole("button", { name: "돌아가기", exact: true })
        .click();
      rejectMemberDeletion = false;
    },
  );
  await check(
    "deleted members leave the list and the current administrator cannot delete itself",
    async () => {
      await page
        .getByRole("button", { name: "회원 삭제하기", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("작업 사유", { exact: true })
        .fill("탈퇴 요청 확인");
      await dialog
        .getByRole("button", { name: "회원 삭제하기", exact: true })
        .click();
      await heading("회원 관리");
      assert.ok(page.url().endsWith("/admin/users"));
      assert.equal(
        await page
          .getByRole("link", { name: "연습 회원", exact: true })
          .count(),
        0,
      );
      assert.ok(deletedMembers.has(30));
      await page.goto(base + "/admin/users/9001");
      await heading("운영 관리자님의 기록");
      assert.equal(
        await page
          .getByRole("button", { name: "회원 삭제하기", exact: true })
          .isDisabled(),
        true,
      );
    },
  );
  await check("mobile navigation and horizontal overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/admin");
    await heading("운영 현황");
    await page.screenshot({
      path: path.join(output, "admin-mobile.png"),
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
  });
  await check(
    "settings reveals administrator entry only after server approval",
    async () => {
      await page.goto(base + "/mypage/settings");
      await heading("설정");
      await page
        .getByRole("link", { name: "관리자 페이지", exact: true })
        .waitFor();
      await page.screenshot({
        path: path.join(output, "admin-settings-entry.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "test membership admin cannot reveal an unauthorized administrator entry",
    async () => {
      allow = false;
      const denial = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/admin/me") && response.status() === 403,
      );
      await page.reload();
      await denial;
      await heading("설정");
      assert.equal(
        await page
          .getByRole("link", { name: "관리자 페이지", exact: true })
          .count(),
        0,
      );
      allow = true;
      await page.goto(base + "/admin");
      await heading("운영 현황");
    },
  );
  await check("a revoked role hides the previous account data", async () => {
    allow = false;
    await page.evaluate(() => {
      localStorage.setItem("speakai.access-token", "different-test-account");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "speakai.access-token",
          newValue: "different-test-account",
        }),
      );
    });
    await heading("관리자 접근을 확인해 주세요");
    assert.equal(
      await page.getByRole("navigation", { name: "관리자 메뉴" }).count(),
      0,
    );
  });
  await check(
    "anonymous login failure does not repeat refresh forever",
    async () => {
      const anonymous = await browser.newContext();
      let requests = 0;
      await anonymous.route("**/api/backend/**", async (route) => {
        requests++;
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            result: false,
            message: "login required",
            data: null,
          }),
        });
      });
      const visitor = await anonymous.newPage();
      await visitor.goto(base + "/admin");
      await visitor
        .getByRole("heading", { name: "관리자 접근을 확인해 주세요" })
        .waitFor();
      await visitor.waitForTimeout(700);
      assert.ok(requests <= 3, `unexpected auth requests: ${requests}`);
      await anonymous.close();
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        checks: results,
        browserErrors: errors,
        writes: writes.map((w) => ({ path: w.path, method: w.method })),
        dispatches,
        puts,
      },
      null,
      2,
    ),
  );
  console.log("ALL PASSED", results.length);
} catch (error) {
  await page.screenshot({
    path: path.join(output, "failure.png"),
    fullPage: true,
  });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
