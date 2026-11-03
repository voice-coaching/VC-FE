import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { adminApi, queryString, subscribeAdminDenial } from "./api";
import { clearAccessToken, saveAccessToken } from "@/lib/api/client";
import {
  parseMemberIds,
  saveContent,
  deleteContent,
  deleteMember,
  createCampaign,
  saveCampaign,
  deleteCampaign,
  deleteNotice,
  deleteReferenceAudio,
  uploadAnnouncerAudio,
  resumeAnnouncerUpload,
  offsetTime,
  type AudioUploadAttempt,
} from "./services";
import type { Content, Campaign, Notice, Audio } from "./types";
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
test("selected notification recipients are positive unique member IDs", () => {
  assert.deepEqual(parseMemberIds("12,34\n56"), [12, 34, 56]);
  for (const input of ["1,1", "0", "1 or 1=1", "9007199254740993"])
    assert.throws(() => parseMemberIds(input));
  assert.throws(() =>
    parseMemberIds(Array.from({ length: 501 }, (_, i) => i + 1).join(",")),
  );
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
test("published and hidden content edit the existing ID with its current version", async () => {
  const data = form({
    type: "ANNOUNCER",
    focus: "PRONUNCIATION",
    category: "ANNOUNCER_PRACTICE",
    difficulty: "BEGINNER",
    title: "수정 제목",
    description: "",
    scriptText: "수정 원문",
    targets: "",
    seconds: "10",
    reason: "검수",
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return result({ ...content, version: 4 });
  };
  for (const status of ["PUBLISHED", "HIDDEN"]) {
    await saveContent(data, {
      ...content,
      status,
      publishedAt: "2026-11-01T00:00:00Z",
    });
    const call = calls.at(-1)!;
    assert.equal(call.options.method, "PATCH");
    assert.ok(call.url.endsWith("/api/admin/contents/279"));
    const body = JSON.parse(String(call.options.body));
    assert.equal(body.version, 3);
    assert.equal(body.content.scriptText, "수정 원문");
    assert.equal(body.status, undefined);
  }
});
test("deletion sends the exact version and reason with the existing authentication", async () => {
  saveAccessToken("test-admin-access");
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return result({ id: 279, version: 4, deletedAt: "2026-11-02T09:00:00Z" });
  };
  const receipt = await deleteContent(content, "검수 후 삭제");
  assert.equal(receipt.id, 279);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "DELETE");
  assert.equal(
    new Headers(calls[0].options.headers).get("authorization"),
    "Bearer test-admin-access",
  );
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
    version: 3,
    reason: "검수 후 삭제",
  });
});
test("deletion rejects missing reasons and mismatched receipts", async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return result({ id: 999, version: 4, deletedAt: "2026-11-02T09:00:00Z" });
  };
  await assert.rejects(deleteContent(content, " "));
  assert.equal(calls.length, 0);
  await assert.rejects(deleteContent(content, "삭제"));
  assert.equal(calls.length, 1);
});
test("conflicting deletion is not retried automatically", async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return Response.json(
      {
        result: false,
        message: "changed",
        code: "ADMIN_EDIT_CONFLICT",
        data: null,
      },
      { status: 409 },
    );
  };
  await assert.rejects(deleteContent(content, "삭제"));
  assert.equal(calls.length, 1);
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

// API codes remain unchanged in requests; only operator-facing text is translated.
test("administrator record labels hide internal fields and format status, money, time and reasons", async () => {
  const {
    displayLabel,
    recordColumnLabel,
    displayRecordValue,
    changedFieldLabels,
  } = await import("./presentation");
  assert.equal(recordColumnLabel("recordingId"), "녹음 번호");
  assert.equal(displayLabel("KAKAO"), "카카오");
  assert.equal(displayRecordValue("ANALYSES", "status", "FAILED"), "실패");
  assert.equal(
    displayRecordValue("ANALYSES", "failureCode", "runpod_execution_failed"),
    "음성 평가를 완료하지 못했습니다",
  );
  assert.equal(displayRecordValue("PAYMENTS", "amount", 15000), "15,000");
  assert.equal(displayLabel("FUTURE_BACKEND_ENUM"), "기타");
  assert.equal(recordColumnLabel("futureInternalField"), "추가 정보");
  assert.equal(changedFieldLabels("scriptText,status"), "연습 원문, 처리 상태");
  assert.equal(displayRecordValue("RECORDINGS", "durationMs", 2500), "2.5초");
});

test("member deletion needs only a reason and preserves the exact account timestamp", async () => {
  const timestamp = "2026-11-03T09:00:00.123456+09:00";
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return result({
      userId: 30,
      deletedAt: "2026-11-03T09:01:00+09:00",
      alreadyDeleted: false,
    });
  };
  await assert.rejects(deleteMember(30, timestamp, " "));
  assert.equal(calls.length, 0);
  await deleteMember(30, timestamp, "삭제 요청 확인");
  assert.equal(calls[0].options.method, "DELETE");
  assert.ok(calls[0].url.endsWith("/users/30"));
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
    expectedUpdatedAt: timestamp,
    reason: "삭제 요청 확인",
  });
});
test("stale member deletion does not retry or report success", async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return Response.json(
      {
        result: false,
        message: "changed",
        code: "ADMIN_EDIT_CONFLICT",
        data: null,
      },
      { status: 409 },
    );
  };
  await assert.rejects(deleteMember(30, "2026-11-03T09:00:00Z", "삭제"));
  assert.equal(calls.length, 1);
});

const draft: Campaign = {
  id: 11,
  version: 4,
  audience: "SELECTED_USERS",
  kind: "GENERAL",
  title: "기존",
  body: "내용",
  deepLink: "/home",
  userIds: [30],
  status: "DRAFT",
  audienceCount: 1,
  sentCount: 0,
  createdAt: "2026-11-03T00:00:00Z",
  sentAt: null,
};
const campaignForm = () =>
  form({
    audience: "SELECTED_USERS",
    kind: "PLAN",
    title: "수정 안내",
    body: "새 내용",
    deepLink: "/mypage",
    userIds: "31,32",
    reason: "대상 정정",
  });
test("editing a draft sends its opened version and full replacement fields without dispatching", async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return result({ ...draft, version: 5 });
  };
  await saveCampaign(campaignForm(), draft);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/api/admin/notification-campaigns/11"));
  assert.equal(calls[0].options.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
    version: 4,
    audience: "SELECTED_USERS",
    kind: "PLAN",
    title: "수정 안내",
    body: "새 내용",
    deepLink: "/mypage",
    userIds: [31, 32],
    reason: "대상 정정",
  });
});
test("sent campaigns cannot be edited or deleted by the service", () => {
  const sent = { ...draft, status: "SENT" as const };
  assert.throws(() => saveCampaign(campaignForm(), sent));
  return assert.rejects(deleteCampaign(sent, "정리"));
});
test("draft editing reuses recipient and link validation before HTTP", () => {
  for (const values of [
    { userIds: "30,30" },
    { userIds: "0" },
    { deepLink: "https://outside.invalid" },
    { reason: " " },
  ]) {
    const data = campaignForm();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    assert.throws(() => saveCampaign(data, draft));
  }
});
test("notice and draft deletion require reason and accept only null success receipts", async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return result(null);
  };
  await deleteNotice({ id: 7, version: 9 } as Notice, "공지 정리");
  await deleteCampaign(draft, "초안 정리");
  assert.deepEqual(
    calls.map((call) => call.options.method),
    ["DELETE", "DELETE"],
  );
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
    version: 9,
    reason: "공지 정리",
  });
  assert.deepEqual(JSON.parse(String(calls[1].options.body)), {
    version: 4,
    reason: "초안 정리",
  });
  await assert.rejects(deleteNotice({ id: 7, version: 9 } as Notice, " "));
  globalThis.fetch = async () => result({ id: 7 });
  await assert.rejects(
    deleteNotice({ id: 7, version: 9 } as Notice, "공지 정리"),
  );
});
const reference: Audio = {
  audioId: 64,
  contentId: 279,
  contentVersion: 3,
  speakerName: "아나운서",
  speakerType: "ANNOUNCER",
  durationMs: null,
  primary: true,
  createdAt: "2026-11-03T00:00:00Z",
};
test("audio deletion uses the parent version and returns replacement primary and advanced version", async () => {
  const receipt = {
    contentVersion: 4,
    items: [{ ...reference, audioId: 65, contentVersion: 4 }],
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return result(receipt);
  };
  assert.deepEqual(await deleteReferenceAudio(reference, "음성 정리"), receipt);
  assert.equal(calls[0].options.method, "DELETE");
  assert.ok(calls[0].url.endsWith("/api/admin/reference-audios/64"));
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
    version: 3,
    reason: "음성 정리",
  });
  globalThis.fetch = async () => result({ items: [], contentVersion: 4 });
  assert.deepEqual(await deleteReferenceAudio(reference, "마지막 정리"), {
    items: [],
    contentVersion: 4,
  });
});
test("audio deletion rejects retained IDs, another content and unchanged parent versions", async () => {
  for (const receipt of [
    { items: [], contentVersion: 3 },
    { items: [{ ...reference, contentVersion: 4 }], contentVersion: 4 },
    {
      items: [{ ...reference, audioId: 65, contentId: 1, contentVersion: 4 }],
      contentVersion: 4,
    },
  ]) {
    globalThis.fetch = async () => result(receipt);
    await assert.rejects(deleteReferenceAudio(reference, "정리"));
  }
});
