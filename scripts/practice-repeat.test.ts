import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { readLipConsent, writeLipConsent } from "../src/lib/lip-consent";

const source = readFileSync(
  "src/components/direct-practice-session.tsx",
  "utf8",
);
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
  if (ts.isFunctionDeclaration(node) && node.name?.text === "clearAttempt")
    clearBody = node.body!.getText(file).slice(1, -1);
  ts.forEachChild(node, visit);
}
visit(file);
function execute(body: string, dependencies: Record<string, unknown>) {
  const code =
    ts.transpile(`function run() {${body}}`, {
      target: ts.ScriptTarget.ES2022,
    }) + "\nreturn run();";
  return new Function(...Object.keys(dependencies), code)(
    ...Object.values(dependencies),
  );
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

for (const withJob of [true, false]) {
  for (const status of [
    "RESULT_READY",
    "FAILED",
    "CANCELLED",
    "RUNNING",
    "QUEUED",
  ]) {
    test(`reopening ${status} with job ID ${withJob} allows completed content to be practiced again`, async () => {
      let removed = false;
      let observed = false;
      let hasAttempt = false;
      let busy = false;
      let linked = false;
      const attempt = { current: null as unknown };
      const cleanup = execute(restoreBody, {
        AbortController,
        controller: { current: null },
        attempt,
        key: "user:sentence",
        localStorage: {
          getItem: () =>
            JSON.stringify({
              attemptId: "old-attempt",
              historyClaim: "old-claim",
              ...(withJob ? { jobId: "old-job" } : {}),
            }),
          removeItem: () => {
            removed = true;
          },
        },
        setHasAttempt: (value: boolean) => {
          hasAttempt = value;
        },
        setBusy: (value: boolean) => {
          busy = value;
        },
        readDirect: async () => ({ status, jobId: "old-job" }),
        findDirect: async () => ({ status, jobId: "old-job" }),
        linkDirectHistory: async (jobId: string, claim: string) => {
          assert.equal(jobId, "old-job");
          assert.equal(claim, "old-claim");
          linked = true;
          return { state: "SAVED" };
        },
        setHistory: () => {},
        update: () => {},
        save: () => {},
        observe: async () => {
          observed = true;
        },
        setError: (error: string) => assert.fail(error),
      });
      await tick();
      const finished = ["RESULT_READY", "FAILED", "CANCELLED"].includes(status);
      assert.equal(removed, finished);
      assert.equal(hasAttempt, !finished);
      assert.equal(observed, !finished);
      assert.equal(linked, status === "RESULT_READY");
      if (finished) {
        assert.equal(attempt.current, null);
        assert.equal(busy, false);
      }
      cleanup();
    });
  }
}

test("retry clears the previous attempt and recording so submission gets a new identity", () => {
  let aborted = false;
  let removed = false;
  let reset = false;
  const state: Record<string, unknown> = {};
  const attempt = { current: { attemptId: "old" } as unknown };
  const dependencies: Record<string, unknown> = {
    controller: {
      current: {
        abort: () => {
          aborted = true;
        },
      },
    },
    attempt,
    key: "user:sentence",
    localStorage: {
      removeItem: () => {
        removed = true;
      },
    },
    recorder: {
      reset: () => {
        reset = true;
      },
    },
  };
  for (const name of [
    "setHasAttempt",
    "setView",
    "setBusy",
    "setError",
    "setHistory",
    "setActiveSentence",
    "setSentenceBoundaries",
  ]) {
    dependencies[name] = (value: unknown) => {
      state[name] = value;
    };
  }
  execute(clearBody, dependencies);
  assert.equal(attempt.current, null);
  assert.equal(state.setView, null);
  assert.equal(state.setHasAttempt, false);
  assert.equal(state.setHistory, "PENDING");
  assert.ok(aborted && removed && reset);
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
