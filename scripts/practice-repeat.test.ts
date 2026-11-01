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
  for (const storageMode of ["raw", "prepared", "missing", "unavailable"]) {
    test(`batch restoration recovers ${storageMode} recordings for content ID ${typeof contentId} without waiting for HTTP`, async () => {
      let pumps = 0;
      let hasAttempt = false;
      let loading = false;
      let failed = false;
      let captured: number[] = [];
      const files = { current: new Map<number, Blob>() };
      const raw = new Blob(["exact captured bytes"]);
      const prepared = new Blob(["prepared bytes"]);
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
        files,
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
        recordingKey: (id: string, index: number) => `${id}:${index}`,
        sentenceRecordings: {
          read: async (key: string) => {
            if (storageMode === "unavailable")
              throw new Error("storage unavailable");
            if (
              key !== `${value.batchId}:0` &&
              key !== `${value.batchId}:0:raw`
            )
              return undefined;
            if (storageMode === "raw")
              return key.endsWith(":raw") ? raw : prepared;
            return storageMode === "prepared" && !key.endsWith(":raw")
              ? prepared
              : undefined;
          },
        },
        setCaptured: (value: number[]) => {
          captured = value;
        },
        pumpRef: {
          current: () => {
            pumps++;
          },
        },
        createSentenceBatch: () =>
          assert.fail("Local recovery must not wait for HTTP"),
        captureError: (error: Error) => {
          assert.equal(error.message, "storage unavailable");
          failed = true;
        },
      });
      await tick();
      assert.equal(pumps, storageMode === "unavailable" ? 0 : 1);
      assert.equal(failed, storageMode === "unavailable");
      assert.equal(hasAttempt, true);
      assert.equal(loading, false);
      assert.deepEqual(saved.current, value);
      assert.deepEqual(
        captured,
        ["raw", "prepared"].includes(storageMode) ? [0] : [],
      );
      assert.equal(
        files.current.get(0),
        storageMode === "raw"
          ? raw
          : storageMode === "prepared"
            ? prepared
            : undefined,
      );
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
    const resetting = { current: false };
    const files = { current: new Map([[0, new Blob(["pending audio"])]]) };
    const dependencies: Record<string, unknown> = {
      controller: { current: new AbortController() },
      saved,
      latestView,
      resetting,
      files,
      running: { current: Promise.resolve() },
      writes: { current: new Set() },
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
      ensure: async (value: unknown, signal: AbortSignal) => {
        assert.equal(value, original);
        assert.equal(signal.aborted, false);
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
      "setCaptured",
      "setRetryIndex",
      "setUploading",
      "setError",
      "setHistory",
    ]) {
      dependencies[name] = (value: unknown) => {
        state[name] = value;
      };
    }
    const succeeded = await execute(clearBody, dependencies, true);
    assert.equal(resetting.current, false);
    if (status === "CANCEL_FAILED") {
      assert.equal(succeeded, false);
      assert.equal(saved.current, original);
      assert.equal(files.current.size, 1);
      assert.deepEqual(calls, ["recover", "cancel", "error"]);
      return;
    }
    assert.equal(succeeded, true);
    assert.equal(saved.current, null);
    assert.equal(latestView.current, null);
    assert.equal(files.current.size, 0);
    assert.equal(state.setView, null);
    assert.equal(state.setHasAttempt, false);
    assert.equal(state.setHistory, "PENDING");
    assert.deepEqual(calls, [
      ...(status === "RESULT_READY" ? ["history"] : []),
      "recover",
      "cancel",
      "remove:old-batch:0",
      "remove:old-batch:1",
      "remove:old-batch:0:raw",
      "remove:old-batch:1:raw",
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
