import assert from "node:assert/strict";
import test from "node:test";
import {
  TrainingRecoveryAttempt,
  type TrainingAttemptRecord,
} from "../src/lib/training-recovery-attempt";
import { ApiError, clearAccessToken } from "../src/lib/api/client";
import type {
  ApiContract,
  AnalysisConsentInput,
  AnalysisProgress,
} from "../src/lib/api/types";
import type { TrainingRecovery } from "../src/lib/api/training-recovery";
import type { RecoveryStore } from "../src/lib/practice-recovery-store";
import { createRemoteApi } from "../src/lib/api/remote";

function fixture(lost?: string) {
  let stored: TrainingAttemptRecord | undefined;
  const store: RecoveryStore = {
    async read<T>() {
      return structuredClone(stored) as T | undefined;
    },
    async write<T>(_user: string, _scope: string, value: T) {
      stored = structuredClone(value) as TrainingAttemptRecord;
    },
    async remove() {
      stored = undefined;
    },
  };
  const counts = {
    session: 0,
    upload: 0,
    put: 0,
    registration: 0,
    analysis: 0,
    retry: 0,
  };
  const receipts = new Map<string, { body: string; result: unknown }>();
  const requests: { stage: string; key: string; body: string }[] = [];
  let disconnected = false;
  let unavailable = false;
  let status: TrainingRecovery["uploads"][number]["status"] = "UPLOAD_REQUIRED";
  let objectKey: string | undefined;
  let recordingId: number | null = null;
  let analysis: AnalysisProgress | null = null;
  let selected: number | null = null;
  let hidden = false;
  async function post(
    stage: keyof typeof counts,
    key: string | undefined,
    body: unknown,
    create: () => unknown,
  ) {
    assert.ok(key, `${stage}: idempotency key required`);
    // Every HTTP mutation must have its exact intent committed locally first.
    assert.ok(stored);
    assert.ok(
      [...Object.values(stored.keys), stored.command?.key].includes(key),
    );
    const serialized = JSON.stringify(body);
    requests.push({ stage, key, body: serialized });
    const receipt = receipts.get(key);
    if (receipt) {
      assert.equal(receipt.body, serialized);
      return structuredClone(receipt.result);
    }
    counts[stage]++;
    const result = create();
    receipts.set(key, { body: serialized, result });
    if (lost === stage && !disconnected) {
      disconnected = true;
      throw new ApiError("response lost after commit", 0);
    }
    return structuredClone(result);
  }
  const training = {
    create: (body: unknown, key?: string) =>
      post("session", key, body, () => ({ sessionId: 401 })),
    getUploadUrl: (_id: unknown, body: unknown, key?: string) =>
      post("upload", key, body, () => {
        objectKey = `uploads/${counts.upload}.wav`;
        status = "UPLOAD_REQUIRED";
        return {
          objectKey,
          uploadUrl: "https://storage.invalid/signed",
          expiresAt: "2026-11-08T11:00:00Z",
        };
      }),
    uploadRecording: async (_info: unknown, blob: Blob) => {
      assert.equal(await blob.text(), "exact retained bytes");
      counts.put++;
      status = "READY_TO_REGISTER";
      if (lost === "put" && !disconnected) {
        disconnected = true;
        throw new ApiError("lost PUT response", 0);
      }
    },
    registerRecording: (_id: unknown, body: unknown, key?: string) =>
      post("registration", key, body, () => {
        recordingId = 501;
        selected = 501;
        status = "REGISTERED";
        return { recordingId };
      }),
    listRecordings: async () =>
      recordingId
        ? [{ recordingId, qualityStatus: "PASS", selected: true }]
        : [],
    analyze: (_id: unknown, body: unknown, key?: string) =>
      post("analysis", key, body, () => {
        analysis = { analysisId: 601, status: "PENDING" } as AnalysisProgress;
        return { analysisId: 601, status: "PENDING" };
      }),
    retryAnalysis: (
      _id: unknown,
      body: unknown,
      _expected: unknown,
      key?: string,
    ) =>
      post("retry", key, body, () => {
        analysis = { analysisId: 602, status: "PENDING" } as AnalysisProgress;
        return { analysisId: 602, status: "PENDING" };
      }),
  } as unknown as ApiContract["training"];
  const dependencies = {
    api: { training },
    store,
    recovery: async (): Promise<TrainingRecovery> => {
      if (unavailable)
        throw new ApiError(
          "HEAD unavailable",
          503,
          "ANALYSIS_INTEGRATION_UNAVAILABLE",
        );
      return {
        sessionId: 401,
        status: "UPLOADING",
        selectedRecordingId: selected,
        analysis,
        uploads:
          objectKey && !hidden
            ? [
                {
                  uploadIntentId: 1,
                  objectKey,
                  mimeType: "audio/wav",
                  fileSizeBytes: 20,
                  status,
                  recordingId,
                  expiresAt: "2026-11-08T11:00:00Z",
                },
              ]
            : [],
        hasMoreUploads: hidden,
        serverTime: "2026-11-08T10:00:00Z",
      };
    },
  };
  const input = {
    userId: "1",
    scope: "attempt",
    context: "immutable script",
    sessionInput: { contentId: 3, learningFocus: "PRONUNCIATION" as const },
    source: {
      blob: new Blob(["exact retained bytes"], { type: "audio/wav" }),
      original: new Blob(["original"]),
      durationMs: 7000,
      mimeType: "audio/wav",
      extension: "wav",
    },
  };
  const open = () => TrainingRecoveryAttempt.open(input, dependencies);
  const reload = () =>
    TrainingRecoveryAttempt.restore(
      "1",
      "attempt",
      input.context,
      dependencies,
    ).then((value) => {
      assert.ok(value);
      return value;
    });
  return {
    open,
    reload,
    counts,
    requests,
    dependencies,
    get stored() {
      return stored!;
    },
    setStatus(value: typeof status) {
      status = value;
    },
    setUnavailable() {
      unavailable = true;
    },
    hide() {
      hidden = true;
    },
    select(value: number) {
      selected = value;
    },
    complete() {
      analysis = { analysisId: 601, status: "COMPLETED" } as AnalysisProgress;
    },
    fail() {
      analysis = { analysisId: 601, status: "FAILED" } as AnalysisProgress;
    },
  };
}
const consent = { consentId: 7 } as unknown as AnalysisConsentInput;

for (const stage of ["session", "upload", "put", "registration", "analysis"]) {
  test(`reload after lost ${stage} acknowledgement recovers the same capture without duplicate work`, async () => {
    const f = fixture(stage);
    const first = await f.open();
    const keys = structuredClone(f.stored.keys);
    await assert.rejects(async () => {
      await first.prepareRecording();
      await first.admission(consent);
    });
    const restored = await f.reload();
    await restored.prepareRecording();
    await restored.admission(consent);
    assert.deepEqual(f.stored.keys, keys);
    assert.equal(f.counts.session, 1);
    assert.equal(f.counts.upload, 1);
    assert.equal(f.counts.put, 1);
    assert.equal(f.counts.registration, 1);
    assert.equal(f.counts.analysis, 1);
    assert.equal(f.stored.analysisId, 601);
  });
}
test("a lost PUT acknowledgement uses READY_TO_REGISTER without retransferring the file", async () => {
  const f = fixture("put");
  await assert.rejects(() => f.open().then((a) => a.prepareRecording()));
  await (await f.reload()).prepareRecording();
  assert.equal(f.counts.put, 1);
});
test("503 stops recovery without assuming the object is missing", async () => {
  const f = fixture("put");
  await assert.rejects(() => f.open().then((a) => a.prepareRecording()));
  f.setUnavailable();
  await assert.rejects(
    () => f.reload().then((a) => a.prepareRecording()),
    (error: ApiError) => error.status === 503,
  );
  assert.equal(f.counts.put, 1);
  assert.equal(f.counts.registration, 0);
  assert.equal(f.counts.analysis, 0);
});
test("EXPIRED rotates only the upload and registration identities, retaining session and exact file", async () => {
  const f = fixture("put");
  await assert.rejects(() => f.open().then((a) => a.prepareRecording()));
  const previous = structuredClone(f.stored.keys);
  f.setStatus("EXPIRED");
  await (await f.reload()).prepareRecording();
  assert.equal(f.counts.session, 1);
  assert.equal(f.counts.upload, 2);
  assert.equal(f.counts.put, 2);
  assert.equal(f.stored.keys.session, previous.session);
  assert.equal(f.stored.keys.analysis, previous.analysis);
  assert.notEqual(f.stored.keys.upload, previous.upload);
  assert.notEqual(f.stored.keys.registration, previous.registration);
});
test("RECORDING_UNAVAILABLE blocks automatic registration and analysis", async () => {
  const f = fixture("put");
  await assert.rejects(() => f.open().then((a) => a.prepareRecording()));
  f.setStatus("RECORDING_UNAVAILABLE");
  await assert.rejects(
    () => f.reload().then((a) => a.prepareRecording()),
    (error: ApiError) => error.code === "RECORDING_UNAVAILABLE",
  );
  assert.equal(f.counts.analysis, 0);
  assert.equal(f.counts.registration, 0);
});
test("a truncated upload list replays issuance instead of treating the object as absent", async () => {
  const f = fixture("put");
  await assert.rejects(() => f.open().then((a) => a.prepareRecording()));
  f.hide();
  await (await f.reload()).prepareRecording();
  assert.equal(f.counts.registration, 1);
  assert.equal(f.counts.upload, 1);
  assert.equal(f.counts.put, 1);
  assert.equal(f.counts.analysis, 0);
  assert.ok(
    f.requests
      .filter((r) => r.stage === "upload")
      .every((r) => r.key === f.stored.keys.upload),
  );
});
test("completed GET state wins over a stale PENDING receipt and never starts another analysis", async () => {
  const f = fixture("analysis");
  const a = await f.open();
  await a.prepareRecording();
  await assert.rejects(() => a.admission(consent));
  f.complete();
  const latest = await (await f.reload()).admission(consent);
  assert.equal(latest.status, "COMPLETED");
  assert.equal(f.counts.analysis, 1);
});
test("an explicit failed-analysis retry retains its key/body across a lost response", async () => {
  const f = fixture("retry");
  const a = await f.open();
  await a.prepareRecording();
  await a.admission(consent);
  f.fail();
  await assert.rejects(() => a.admission(consent, true));
  const key = f.stored.command!.key;
  await (await f.reload()).admission(undefined, true);
  assert.equal(f.counts.retry, 1);
  assert.equal(f.stored.command!.key, key);
  assert.equal(f.stored.analysisId, 602);
});
test("actual selected-recording changes stop recovery without selection or new inference", async () => {
  const f = fixture();
  const a = await f.open();
  await a.prepareRecording();
  await a.admission(consent);
  f.select(999);
  await assert.rejects(
    () => f.reload().then((a) => a.prepareRecording()),
    (error: ApiError) => error.code === "CANONICAL_ATTEMPT_CHANGED",
  );
  assert.equal(f.counts.analysis, 1);
});
test("local storage failure prevents all HTTP mutations", async () => {
  const f = fixture();
  f.dependencies.store.write = async () => {
    throw new Error("quota exceeded");
  };
  await assert.rejects(() => f.open());
  assert.equal(f.counts.session, 0);
});
test("login changes while reading durable state cannot adopt the next user's session", async () => {
  const f = fixture();
  f.dependencies.store.read = async () => {
    clearAccessToken();
    return undefined;
  };
  await assert.rejects(
    () => f.open(),
    (error: ApiError) => error.code === "AUTH_SESSION_CHANGED",
  );
  assert.equal(f.counts.session, 0);
});
test("all five HTTP adapters transmit the durable key and keep the existing V6 schema", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    assert.equal(
      new Headers(init?.headers).get("Idempotency-Key"),
      "persisted-key",
    );
    assert.equal(init?.method, "POST");
    if (path.endsWith("/analyze") || path.endsWith("/analysis/retry"))
      assert.equal(
        new Headers(init?.headers).get("X-Analysis-Result-Schema"),
        "voice-coaching.runpod-analysis-result.v6",
      );
    return Response.json({
      result: true,
      data: { sessionId: 401, recordingId: 501, analysisId: 601 },
    });
  };
  try {
    const training = createRemoteApi("https://backend.invalid").training;
    await training.create(
      { contentId: 3, learningFocus: "PRONUNCIATION" },
      "persisted-key",
    );
    await training.getUploadUrl(
      401,
      { fileName: "same.wav", mimeType: "audio/wav", fileSizeBytes: 20 },
      "persisted-key",
    );
    await training.registerRecording(
      401,
      {
        objectKey: "same.wav",
        mimeType: "audio/wav",
        fileSizeBytes: 20,
        durationMs: 7000,
      },
      "persisted-key",
    );
    await training.analyze(401, undefined, "persisted-key");
    await training.retryAnalysis(401, undefined, undefined, "persisted-key");
    assert.deepEqual(paths, [
      "/api/training-sessions",
      "/api/training-sessions/401/recordings/upload-url",
      "/api/training-sessions/401/recordings",
      "/api/training-sessions/401/analyze",
      "/api/training-sessions/401/analysis/retry",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
