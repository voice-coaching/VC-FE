import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { adminApi, queryString, subscribeAdminDenial } from "./api";
import { clearAccessToken, saveAccessToken } from "@/lib/api/client";
import {
  parseMemberIds,
  identifierValue,
  saveContent,
  createCampaign,
  uploadAnnouncerAudio,
  resumeAnnouncerUpload,
  offsetTime,
  type AudioUploadAttempt,
} from "./services";
import type { Content } from "./types";
const originalFetch = globalThis.fetch;
let calls: { url: string; options: RequestInit }[] = [];
const result = (data: unknown) =>
  Response.json({ result: true, message: "test", data });
beforeEach(() => {
  calls = [];
  clearAccessToken();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});
const content: Content = {
  id: 279,
  version: 3,
  type: "ANNOUNCER",
  focus: "PRONUNCIATION",
  category: "ANNOUNCER_PRACTICE",
  difficulty: "BEGINNER",
  title: "연습",
  description: null,
  scriptText: "오늘의 소식을 전합니다.",
  targetPronunciations: [],
  estimatedSeconds: 10,
  status: "DRAFT",
  publishedAt: null,
  updatedAt: "2026-11-01T00:00:00Z",
};
function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
test("selected recipients are positive unique IDs and UUID search never accepts SQL", () => {
  assert.deepEqual(parseMemberIds("12,34\n56"), [12, 34, 56]);
  for (const input of ["1,1", "0", "1 or 1=1", "9007199254740993"])
    assert.throws(() => parseMemberIds(input));
  assert.throws(() =>
    parseMemberIds(Array.from({ length: 501 }, (_, i) => i + 1).join(",")),
  );
  assert.equal(
    identifierValue(" 532fe9f8-14e4-47ce-a011-7c9d5f6a2acd "),
    "532fe9f8-14e4-47ce-a011-7c9d5f6a2acd",
  );
  assert.throws(() => identifierValue("' or 1=1 --"));
});
test("filters are encoded and whole list omits empty category", () => {
  assert.equal(
    queryString({
      keyword: "홍길동 & 검색",
      page: 0,
      published: false,
      category: "",
    }),
    "?keyword=%ED%99%8D%EA%B8%B8%EB%8F%99+%26+%EA%B2%80%EC%83%89&page=0&published=false",
  );
});
test("test membership admin cannot satisfy actual admin access", async () => {
  globalThis.fetch = async () =>
    result({
      id: 1,
      nickname: "member",
      role: "USER",
      membershipType: "admin",
    });
  await assert.rejects(adminApi.access());
});
test("revoked admin access broadcasts a denial and all reads request no-store", async () => {
  let denied = 0;
  const unsubscribe = subscribeAdminDenial(() => denied++);
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return Response.json(
      { result: false, message: "denied", data: null, code: "ACCESS_DENIED" },
      { status: 403 },
    );
  };
  await assert.rejects(adminApi.read("/users"));
  unsubscribe();
  assert.equal(denied, 1);
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.credentials, "include");
});
test("published content is never sent to the draft edit endpoint", async () => {
  const data = form({
    type: "ANNOUNCER",
    focus: "PRONUNCIATION",
    category: "ANNOUNCER_PRACTICE",
    difficulty: "BEGINNER",
    title: "제목",
    description: "",
    scriptText: "문장",
    targets: "",
    seconds: "10",
    reason: "검수",
  });
  globalThis.fetch = async () => {
    throw new Error("unexpected network");
  };
  await assert.rejects(
    saveContent(data, {
      ...content,
      status: "PUBLISHED",
      publishedAt: "2026-11-01T00:00:00Z",
    }),
    /새 초안/,
  );
});
test("selected campaign validates the recipient list and creates only a draft", async () => {
  const data = form({
    audience: "SELECTED_USERS",
    kind: "PLAN",
    userIds: "12,34",
    title: "요금제 안내",
    body: "내용",
    deepLink: "/mypage",
    reason: "안내 등록",
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return result({ id: 1, status: "DRAFT" });
  };
  await createCampaign(data);
  const body = JSON.parse(String(calls[0].options.body));
  assert.deepEqual(body.userIds, [12, 34]);
  assert.equal(body.kind, "PLAN");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/backend/api/admin/notification-campaigns");
  data.set("userIds", "");
  assert.throws(() => createCampaign(data));
  assert.equal(calls.length, 1);
});
test("announcer PUT omits credentials and JWT; repeated PUT reuses the same upload ID", async () => {
  saveAccessToken("test-only-opaque-token");
  const file = new File([new Uint8Array([1, 2, 3, 4])], "sample.mp3", {
    type: "audio/mpeg",
  });
  const intent = {
    uploadId: "test-upload-id",
    uploadUrl: "https://storage.example.invalid/signed",
    requiredHeaders: { "content-type": "audio/mpeg", "if-none-match": "*" },
    expiresAt: "2099-01-01T00:00:00Z",
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    if (String(url).endsWith("/upload-url")) return result(intent);
    if (String(url).startsWith("https://storage"))
      return new Response(null, { status: 412 });
    return result({ audioId: 64 });
  };
  let attempt: AudioUploadAttempt | undefined;
  const data = form({
    speakerName: "전문 아나운서",
    primary: "on",
    reason: "검수",
  });
  await uploadAnnouncerAudio(content, file, data, (value) => {
    attempt = value;
  });
  const request = JSON.parse(String(calls[0].options.body));
  const sha = Buffer.from(
    await webcrypto.subtle.digest("SHA-256", await file.arrayBuffer()),
  ).toString("hex");
  assert.equal(request.sha256, sha);
  assert.equal(request.version, 3);
  const put = calls[1].options;
  assert.equal(put.credentials, "omit");
  assert.equal(put.redirect, "error");
  assert.equal(new Headers(put.headers).has("Authorization"), false);
  assert.equal(new Headers(put.headers).has("Cookie"), false);
  assert.equal(
    JSON.parse(String(calls[2].options.body)).uploadId,
    "test-upload-id",
  );
  assert.ok(attempt);
  await resumeAnnouncerUpload(attempt);
  assert.equal(
    calls.filter((call) => call.url.endsWith("/upload-url")).length,
    1,
  );
});
test("an auth change prevents replaying an earlier account's upload", async () => {
  const attempt: AudioUploadAttempt = {
    contentId: 1,
    session: -1,
    file: new File(["test"], "test.mp3"),
    registration: {
      uploadId: "x",
      version: 0,
      speakerName: "검수",
      primary: true,
      reason: "검수",
    },
    intent: {
      uploadId: "x",
      uploadUrl: "https://storage.example.invalid/signed",
      requiredHeaders: {},
      expiresAt: "2099-01-01",
    },
  };
  globalThis.fetch = async () => {
    throw new Error("unexpected network");
  };
  await assert.rejects(resumeAnnouncerUpload(attempt), /계정이 변경/);
});
test("invalid file types are rejected before issuing an upload URL", async () => {
  globalThis.fetch = async () => {
    throw new Error("unexpected network");
  };
  await assert.rejects(
    uploadAnnouncerAudio(
      content,
      new File(["test"], "test.html"),
      form({ reason: "검수", speakerName: "아나운서" }),
      () => {},
    ),
    /MP3/,
  );
});
test("local editor date values must be valid and become an explicit offset", () => {
  assert.equal(
    offsetTime("2026-11-02T09:00:00+09:00"),
    "2026-11-02T00:00:00.000Z",
  );
  assert.throws(() => offsetTime(""));
});
