import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { readLipConsent, writeLipConsent } from "../src/lib/lip-consent";

const source = readFileSync("src/hooks/use-sentence-batch.ts", "utf8");
const file = ts.createSourceFile(
  "session.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let restoreBody = "";
let clearBody = "";
function visit(node: ts.Node) {
  if (
    !restoreBody &&
    ts.isCallExpression(node) &&
    node.expression.getText(file) === "useEffect"
  ) {
    const callback = node.arguments[0] as ts.ArrowFunction;
    restoreBody = callback.body.getText(file).slice(1, -1);
  }
  if (ts.isFunctionDeclaration(node) && node.name?.text === "reset")
    clearBody = node.body!.getText(file).slice(1, -1);
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(restoreBody, "The active batch restoration effect must be tested");
assert.ok(clearBody, "The active batch reset handler must be tested");
function execute(
  body: string,
  dependencies: Record<string, unknown>,
  asynchronous = false,
) {
  const code =
    ts.transpile(`${asynchronous ? "async " : ""}function run() {${body}}`, {
      target: ts.ScriptTarget.ES2022,
    }) + "\nreturn run();";
  return new Function(...Object.keys(dependencies), code)(
    ...Object.values(dependencies),
  );
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

for (const contentId of [5, "5"]) {
  for (const status of [
    "RESULT_READY",
    "CANCELLED",
    "RECORDING",
    "PROCESSING",
  ]) {
    test(`batch restoration recovers ${status} for content ID ${typeof contentId} without creating another run`, async () => {
      let admissions = 0;
      let hasAttempt = false;
      let loading = false;
      let applied: unknown;
      const saved = { current: null as unknown };
      const sentences = ["첫 문장입니다.", "다음 문장입니다."];
      const value = {
        batchId: "existing-batch",
        historyClaim: "existing-claim",
        sentences,
      };
      const cleanup = execute(restoreBody, {
        AbortController,
        controller: { current: null },
        saved,
        savedSchema: { parse: (value: unknown) => value },
        scripts: JSON.stringify(sentences),
        contentId,
        key: "user:sentence",
        localStorage: {
          getItem: () => JSON.stringify(value),
          removeItem: () =>
            assert.fail("Restoration must retain the admitted batch"),
        },
        setHasAttempt: (value: boolean) => {
          hasAttempt = value;
        },
        setLoading: (value: boolean) => {
          loading = value;
        },
        sha256: async (claim: string) => {
          assert.equal(claim, value.historyClaim);
          return "claim-digest";
        },
        createSentenceBatch: async (
          id: string,
          text: string[],
          content: number,
          digest: string,
        ) => {
          admissions++;
          assert.equal(id, value.batchId);
          assert.deepEqual(text, sentences);
          assert.equal(content, 5);
          assert.equal(digest, "claim-digest");
          return { status, batchId: id };
        },
        apply: (value: unknown) => {
          applied = value;
        },
        captureError: (error: unknown) => assert.fail(String(error)),
      });
      await tick();
      assert.equal(admissions, 1);
      assert.equal(hasAttempt, true);
      assert.equal(loading, false);
      assert.deepEqual(saved.current, value);
      assert.deepEqual(applied, { status, batchId: value.batchId });
      cleanup();
    });
  }
}

for (const status of ["RESULT_READY", "PROCESSING", "CANCEL_FAILED"])
  test(`batch reset ${status} preserves history claims and clears local bytes only after confirmed cancellation`, async () => {
    const calls: string[] = [];
    const state: Record<string, unknown> = {};
    const original = {
      batchId: "old-batch",
      historyClaim: "claim",
      sentences: ["첫 문장", "다음 문장"],
    };
    const saved = { current: original as unknown };
    const latestView = { current: { status } as unknown };
    const gate = { current: false };
    const dependencies: Record<string, unknown> = {
      controller: { current: new AbortController() },
      saved,
      latestView,
      gate,
      contentId: 5,
      view: { status, results: [{ analysis: { jobId: "job", result: {} } }] },
      getAuthenticatedUserId: () => "user",
      sentenceHistoryLinks: () => ({
        enqueue: (jobs: string[], claim: string) => {
          assert.deepEqual(jobs, ["job"]);
          assert.equal(claim, "claim");
          calls.push("history");
        },
      }),
      sha256: async () => "claim-digest",
      createSentenceBatch: async (id: string) => {
        assert.equal(id, original.batchId);
        calls.push("recover");
      },
      cancelSentenceBatch: async () => {
        calls.push("cancel");
        if (status === "CANCEL_FAILED") throw new Error("offline");
      },
      sentenceRecordings: {
        remove: async (key: string) => {
          calls.push(`remove:${key}`);
        },
      },
      recordingKey: (batch: string, index: number) => `${batch}:${index}`,
      key: "user:sentence",
      localStorage: {
        removeItem: () => {
          calls.push("manifest");
        },
      },
      captureError: (reason: Error) => {
        assert.equal(reason.message, "offline");
        calls.push("error");
      },
    };
    for (const name of [
      "setHasAttempt",
      "setView",
      "setUrls",
      "setPendingRecording",
      "setError",
      "setHistory",
    ]) {
      dependencies[name] = (value: unknown) => {
        state[name] = value;
      };
    }
    const succeeded = await execute(clearBody, dependencies, true);
    assert.equal(gate.current, false);
    if (status === "CANCEL_FAILED") {
      assert.equal(succeeded, false);
      assert.equal(saved.current, original);
      assert.deepEqual(calls, ["recover", "cancel", "error"]);
      return;
    }
    assert.equal(succeeded, true);
    assert.equal(saved.current, null);
    assert.equal(latestView.current, null);
    assert.equal(state.setView, null);
    assert.equal(state.setHasAttempt, false);
    assert.equal(state.setHistory, "PENDING");
    assert.deepEqual(calls, [
      ...(status === "RESULT_READY" ? ["history"] : []),
      "recover",
      "cancel",
      "remove:old-batch:0",
      "remove:old-batch:1",
      "manifest",
    ]);
  });

test("lip consent survives a new visit, remains account-specific, and can be revoked", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  assert.equal(readLipConsent("one", storage), false);
  writeLipConsent("one", true, storage);
  assert.equal(readLipConsent("one", storage), true);
  assert.equal(readLipConsent("two", storage), false);
  assert.equal(readLipConsent(null, storage), false);
  writeLipConsent("one", false, storage);
  assert.equal(readLipConsent("one", storage), false);
});

test("disabled local storage does not block practice or count as remembered consent", () => {
  const unavailable = () => {
    throw new Error("Unavailable");
  };
  const storage = {
    getItem: unavailable,
    setItem: unavailable,
    removeItem: unavailable,
  };
  assert.equal(readLipConsent("one", storage), false);
  assert.doesNotThrow(() => writeLipConsent("one", true, storage));
});
