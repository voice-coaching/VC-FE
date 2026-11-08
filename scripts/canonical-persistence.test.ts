import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { ApiError } from "../src/lib/api/client";
import type { CanonicalAnalysisView } from "../src/lib/canonical-analysis";
import {
  awaitCanonicalPersistence,
  canonicalLookupIdentity,
  refreshCanonicalPersistence,
  invalidatesCanonicalResult,
} from "../src/lib/canonical-persistence";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const fixture = (): CanonicalAnalysisView =>
  JSON.parse(
    readFileSync(
      new URL("./fixtures/lip-analysis-view.json", import.meta.url),
      "utf8",
    ),
  );
const json = (data: unknown) => Response.json({ result: true, data });
const changed = () =>
  Response.json(
    { result: false, code: "CANONICAL_ANALYSIS_CHANGED", message: "changed" },
    { status: 409 },
  );

test("full view becomes exactly four IDs for manual refresh and automatic persistence", async () => {
  const view = fixture();
  assert.deepEqual(Object.keys(canonicalLookupIdentity(view)), [
    "analysisId",
    "recordingId",
    "requestId",
    "executionId",
  ]);
  const requests: string[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(init?.method, "GET");
    requests.push(String(url));
    return json(view);
  };
  assert.equal(
    (await refreshCanonicalPersistence(view)).analysisId,
    view.analysisId,
  );
  assert.equal(
    (
      await awaitCanonicalPersistence(
        view,
        new AbortController().signal,
        () => {},
      )
    ).persistenceStatus,
    "SAVED",
  );
  assert.equal(requests.length, 2);
});

test("one server 409 recovers by GET of the same analysis without submitting", async () => {
  const view = fixture();
  const paths: string[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(init?.method, "GET");
    paths.push(String(url));
    return paths.length === 1 ? changed() : json(view);
  };
  assert.equal(
    (await refreshCanonicalPersistence(view)).executionId,
    view.executionId,
  );
  assert.equal(paths.length, 2);
  assert.equal(new Set(paths).size, 1);
});

test("persistent ambiguous 409 stops after three reads and keeps the preview recoverable", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return changed();
  };
  await assert.rejects(
    awaitCanonicalPersistence(
      fixture(),
      new AbortController().signal,
      () => {},
    ),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === "CANONICAL_REFRESH_WAIT_TIMEOUT" &&
      !invalidatesCanonicalResult(error),
  );
  assert.equal(calls, 3);
});

test("a returned different execution immediately invalidates the result", async () => {
  const view = fixture();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return json({
      ...view,
      executionId: "00000000-0000-4000-8000-000000000099",
    });
  };
  await assert.rejects(refreshCanonicalPersistence(view), (error: unknown) =>
    invalidatesCanonicalResult(error),
  );
  assert.equal(calls, 1);
});

test("explicit attempt changes and lost access stop without retry", async () => {
  for (const [status, code] of [
    [403, "FORBIDDEN"],
    [404, "RESOURCE_NOT_FOUND"],
    [409, "CANONICAL_ATTEMPT_CHANGED"],
  ] as const) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ result: false, code }, { status });
    };
    await assert.rejects(
      refreshCanonicalPersistence(fixture()),
      invalidatesCanonicalResult,
    );
    assert.equal(calls, 1);
  }
});

test("abort during 409 recovery prevents another request", async () => {
  const owner = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return changed();
  };
  const pending = refreshCanonicalPersistence(fixture(), owner.signal);
  setTimeout(() => owner.abort(new Error("cancelled")), 20);
  await assert.rejects(pending);
  assert.equal(calls, 1);
});
