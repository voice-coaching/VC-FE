import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  createCanonicalAnalysisClient,
  AUDIOVISUAL_RESULT_HEADER,
} from "../src/lib/api/canonical";
import { requireAnalysisScope } from "../src/lib/api/analysis-capabilities";
import {
  AUDIOVISUAL_PROFILE,
  HANDOFF_PROFILE,
} from "../src/lib/canonical-analysis";
import { ApiError } from "../src/lib/api/client";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const scope = { supported: true, reasonCode: null };
const capabilities = () => ({
  capabilityVersion: "voice-coaching.analysis-capabilities.v1",
  analysisProfile: AUDIOVISUAL_PROFILE,
  resultSchemas: [AUDIOVISUAL_RESULT_HEADER],
  admissionEnabled: true,
  scopes: {
    STANDALONE_AUDIO: scope,
    COURSE: scope,
    TITLE_EXAM: scope,
    VIDEO: scope,
  },
});
const json = (data: unknown) => Response.json({ result: true, data });

test("new audio/video requests and retries all select the unified V6 result contract", async () => {
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(String(input));
    assert.equal(
      new Headers(init?.headers).get("X-Analysis-Result-Schema"),
      AUDIOVISUAL_RESULT_HEADER,
    );
    return json({ analysisId: 1 });
  };
  const client = createCanonicalAnalysisClient("https://qa.example.test");
  const consent = { accepted: true as const, policyRevision: "current" };
  await client.analyze(10, consent);
  await client.retry(10, consent);
  await client.analyzeAudiovisual(10, consent);
  await client.retryAudiovisual(10, consent);
  assert.equal(requests.length, 4);
});

test("V6 capabilities authorize audio, course and title scopes independently", async () => {
  globalThis.fetch = async () => json(capabilities());
  for (const requested of ["STANDALONE_AUDIO", "COURSE", "TITLE_EXAM"] as const)
    assert.equal(
      (await requireAnalysisScope(requested)).analysisProfile,
      AUDIOVISUAL_PROFILE,
    );
});

test("capability checks preserve admission/schema/scope refusals without a legacy fallback", async () => {
  for (const value of [
    { ...capabilities(), admissionEnabled: false },
    { ...capabilities(), resultSchemas: [] },
    { ...capabilities(), analysisProfile: HANDOFF_PROFILE },
  ]) {
    globalThis.fetch = async () => json(value);
    await assert.rejects(
      requireAnalysisScope("COURSE"),
      (error: unknown) => error instanceof ApiError && error.status === 503,
    );
  }
  const value = capabilities();
  value.scopes.COURSE = {
    supported: false,
    reasonCode: "COURSE_ANALYSIS_UNSUPPORTED",
  } as never;
  globalThis.fetch = async () => json(value);
  await assert.rejects(
    requireAnalysisScope("COURSE"),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
});
