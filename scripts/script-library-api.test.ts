import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { scriptLibrary } from "../src/lib/script-library";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("custom script practice uses the existing VC-BE creation endpoint and DTO", async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "/api/backend/api/practice-contents/custom");
    assert.equal(init?.method, "POST");
    assert.equal(
      new Headers(init?.headers).get("Idempotency-Key"),
      "script-key",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      title: "제목",
      scriptText: "연습할 문장입니다.",
      learningFocus: "PRONUNCIATION",
      retention: "SESSION_HISTORY",
      locale: "ko-KR",
    });
    return Response.json({
      result: true,
      data: { id: 91, scriptText: "연습할 문장입니다." },
    });
  };
  const content = await scriptLibrary.save(
    null,
    { title: "제목", scriptText: "연습할 문장입니다.", topicId: 3 },
    "script-key",
  );
  assert.equal(content.id, 91);
  assert.equal(calls, 1);
});

test("unsupported library and topic actions never call nonexistent routes or pretend to succeed", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Unexpected HTTP request");
  };
  for (const action of [
    () => scriptLibrary.list(),
    () =>
      scriptLibrary.save(
        91,
        { title: "수정", scriptText: "다른 문장", topicId: null },
        "key",
      ),
    () => scriptLibrary.remove([91]),
    () => scriptLibrary.createTopic("발표"),
    () => scriptLibrary.renameTopic(3, "면접"),
    () => scriptLibrary.removeTopic(3),
  ])
    await assert.rejects(action(), /보관함은 준비 중/);
  assert.equal(calls, 0);
});
