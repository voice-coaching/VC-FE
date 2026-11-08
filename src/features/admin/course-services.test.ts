import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { saveAdminCourse, type AdminCourse } from "./course-services";
const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});
const course: AdminCourse = {
  id: 3,
  version: 2,
  courseType: "INTONATION",
  title: "억양 클래스",
  description: "소개",
  difficulty: "ADVANCED",
  status: "PUBLISHED",
  estimatedMinutes: 5,
  updatedAt: null,
  sentences: Array.from({ length: 5 }, (_, i) => ({
    contentId: i + 10,
    contentVersion: 0,
    title: `문장 ${i + 1}`,
    text: `원문 ${i + 1}`,
    hint: "",
    focus: "INTONATION",
    estimatedSeconds: 15,
  })),
};
function form() {
  const data = new FormData();
  for (const key of [
    "courseType",
    "title",
    "description",
    "difficulty",
    "status",
    "estimatedMinutes",
  ] as const)
    data.set(key, String(course[key]));
  data.set("reason", "문장 수정");
  return data;
}
test("save edits one real course with the remaining ordered sentences, never individual deletes", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push(String(input));
    assert.equal(init?.method, "PATCH");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.version, 2);
    assert.equal(body.course.sentences.length, 4);
    assert.equal(body.course.sentences[0].text, "수정 원문");
    return Response.json({
      result: true,
      data: { ...course, ...body.course, version: 3 },
    });
  };
  const remaining = course.sentences.slice(0, 4).map((row, index) => ({
    ...row,
    text: index === 0 ? "수정 원문" : row.text,
  }));
  const result = await saveAdminCourse(form(), remaining, course);
  assert.equal(result.version, 3);
  assert.deepEqual(calls, ["/api/backend/api/admin/courses/3"]);
});
test("foreign and duplicate sentence identities are rejected before sending", async () => {
  globalThis.fetch = async () => {
    throw new Error("must not send");
  };
  await assert.rejects(
    () =>
      saveAdminCourse(
        form(),
        [{ ...course.sentences[0], contentId: 999 }],
        course,
      ),
    /다른 클래스/,
  );
  await assert.rejects(
    () =>
      saveAdminCourse(
        form(),
        [course.sentences[0], course.sentences[0]],
        course,
      ),
    /다른 클래스/,
  );
});
test("an empty class, missing reason or too many sentences cannot be submitted", async () => {
  globalThis.fetch = async () => {
    throw new Error("must not send");
  };
  await assert.rejects(() => saveAdminCourse(form(), [], course));
  const missing = form();
  missing.set("reason", "");
  await assert.rejects(() =>
    saveAdminCourse(missing, course.sentences, course),
  );
  await assert.rejects(() =>
    saveAdminCourse(form(), Array(11).fill(course.sentences[0]), course),
  );
});
test("new class uses a single creation endpoint with no previous sentence identities", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/backend/api/admin/courses");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.version, undefined);
    return Response.json({
      result: true,
      data: { ...course, ...body.course, version: 1 },
    });
  };
  await saveAdminCourse(
    form(),
    course.sentences.map((row) => ({
      ...row,
      contentId: null,
      contentVersion: null,
    })),
  );
});
test("409 propagates without automatically resubmitting", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json(
      { result: false, code: "ADMIN_EDIT_CONFLICT", message: "충돌" },
      { status: 409 },
    );
  };
  await assert.rejects(() => saveAdminCourse(form(), course.sentences, course));
  assert.equal(calls, 1);
});
