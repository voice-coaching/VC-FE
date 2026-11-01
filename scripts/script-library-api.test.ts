import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  scriptLibrary,
  SCRIPT_LIBRARY_AVAILABLE,
} from "../src/lib/script-library";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const base = "/api/backend/api/users/me/script-library";

test("library creation and immutable edits send the DTO and retry key to VC-BE", async () => {
  assert.equal(SCRIPT_LIBRARY_AVAILABLE, true);
  const input = { title: "제목", scriptText: "연습할 문장입니다.", topicId: 3 };
  const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(
      new Headers(init?.headers).get("Idempotency-Key"),
      "script-key",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), input);
    assert.equal(init?.method, calls.length === 1 ? "POST" : "PUT");
    return Response.json({
      result: true,
      data: { id: calls.length === 1 ? 91 : 92, ...input },
    });
  };
  assert.equal((await scriptLibrary.save(null, input, "script-key")).id, 91);
  assert.equal((await scriptLibrary.save(91, input, "script-key")).id, 92);
  assert.deepEqual(calls, [base, `${base}/91`]);
});

test("library, bulk deletion and topic CRUD use implemented authenticated routes", async () => {
  const calls: unknown[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push([
      String(url),
      init?.method ?? "GET",
      init?.body ? JSON.parse(String(init.body)) : null,
    ]);
    return Response.json({
      result: true,
      data: { items: [], topics: [], assignments: {} },
    });
  };
  await scriptLibrary.list();
  await scriptLibrary.remove([91, "92"]);
  await scriptLibrary.createTopic("발표");
  await scriptLibrary.renameTopic(3, "면접");
  await scriptLibrary.removeTopic(3);
  assert.deepEqual(calls, [
    [base, "GET", null],
    [`${base}/delete`, "POST", { ids: [91, 92] }],
    [`${base}/topics`, "POST", { name: "발표" }],
    [`${base}/topics/3`, "PUT", { name: "면접" }],
    [`${base}/topics/3`, "DELETE", null],
  ]);
});

test("failed saves and deletions propagate the server error without reporting success", async () => {
  globalThis.fetch = async () =>
    Response.json(
      {
        result: false,
        message: "이미 있는 주제예요.",
        code: "TOPIC_NAME_CONFLICT",
      },
      { status: 409 },
    );
  await assert.rejects(scriptLibrary.createTopic("발표"), /이미 있는 주제/);
  await assert.rejects(scriptLibrary.remove([91]), /이미 있는 주제/);
});
