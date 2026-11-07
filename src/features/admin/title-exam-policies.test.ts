import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { saveAccessToken, clearAccessToken } from "@/lib/api/client";
import {
  saveTitleExamPolicy,
  policyListSchema,
  type TitleExamPolicy,
} from "./title-exam-policies";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});
const policy: TitleExamPolicy = {
  targetRank: "BEGINNER",
  targetTitle: "초보",
  version: 3,
  passingScore: 70,
  requiredTrainingCount: 5,
  practiceContentId: 10,
  available: true,
  content: {
    id: 10,
    version: 2,
    title: "시험 문장",
    scriptText: "정확히 읽습니다.",
    type: "SENTENCE",
    category: "TITLE_EXAM",
    focus: "PRONUNCIATION",
    status: "PUBLISHED",
  },
};
function form(score = "80", reason = "시험 기준 변경") {
  const data = new FormData();
  data.set("passingScore", score);
  data.set("reason", reason);
  return data;
}
const updated = () => ({ ...policy, version: 4, passingScore: 80 });
test("policy edit sends rank, captured policy/content versions and reason with signed login", async () => {
  saveAccessToken("admin-fixture");
  globalThis.fetch = async (url, options) => {
    assert.equal(
      String(url),
      "/api/backend/api/admin/title-exam-policies/BEGINNER",
    );
    assert.equal(options?.method, "PATCH");
    assert.equal(
      new Headers(options?.headers).get("authorization"),
      "Bearer admin-fixture",
    );
    assert.deepEqual(JSON.parse(String(options?.body)), {
      practiceContentId: 10,
      contentVersion: 2,
      passingScore: 80,
      version: 3,
      reason: "시험 기준 변경",
    });
    return Response.json({ result: true, data: updated() });
  };
  assert.equal((await saveTitleExamPolicy(policy, 10, 2, form())).version, 4);
});
test("invalid score, missing selection and empty reason never send a request", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({});
  };
  for (const value of ["", "0", "101", "80.5", "abc"])
    await assert.rejects(saveTitleExamPolicy(policy, 10, 2, form(value)));
  await assert.rejects(saveTitleExamPolicy(policy, 0, 2, form()));
  await assert.rejects(saveTitleExamPolicy(policy, 10, 2, form("80", " ")));
  assert.equal(calls, 0);
});
test("conflicts are not retried automatically", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json(
      {
        result: false,
        code: "ADMIN_EDIT_CONFLICT",
        message: "다시 조회해 주세요.",
      },
      { status: 409 },
    );
  };
  await assert.rejects(saveTitleExamPolicy(policy, 10, 2, form()));
  assert.equal(calls, 1);
});
test("mismatched rank or unchanged version cannot be reported as a successful save", async () => {
  for (const result of [
    { ...updated(), targetRank: "ANNOUNCER" },
    { ...updated(), version: 3 },
    { ...updated(), practiceContentId: 99 },
  ]) {
    globalThis.fetch = async () =>
      Response.json({ result: true, data: result });
    await assert.rejects(
      saveTitleExamPolicy(policy, 10, 2, form()),
      /저장 결과/,
    );
  }
});
test("missing/deleted linked question is represented as unavailable, not fabricated", () => {
  assert.equal(
    policyListSchema.parse({
      items: [{ ...policy, available: false, content: null }],
    }).items[0].available,
    false,
  );
  assert.equal(
    policyListSchema.safeParse({ items: [{ ...policy, version: -1 }] }).success,
    false,
  );
});
