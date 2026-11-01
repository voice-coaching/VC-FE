import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { ApiError } from "../src/lib/api/client";
import { PracticeInputError } from "../src/lib/practice-error";
import {
  analysisAdmissionMissing,
  analysisRequestWasRejected,
} from "../src/lib/canonical-recovery";
import type { TrainingSession } from "../src/lib/api/types";
import type { SentenceAnalysisAdmission } from "../src/lib/sentence-sequence";

const source = readFileSync(
  "src/components/recording-practice-session.tsx",
  "utf8",
);
const file = ts.createSourceFile(
  "recording-practice-session.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let body = "";
let startBody = "";
let autoSubmitBody = "";
let checkBody = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "analyze")
    body = node.body!.getText(file).slice(1, -1);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "startRecording")
    startBody = node.body!.getText(file).slice(1, -1);
  if (
    ts.isFunctionDeclaration(node) &&
    node.name?.text === "checkExistingAnalysis"
  )
    checkBody = node.body!.getText(file).slice(1, -1);
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(file) === "useEffect"
  ) {
    const callback = node.arguments[0];
    if (
      callback &&
      ts.isArrowFunction(callback) &&
      callback.body.getText(file).includes("autoSubmittedBlobRef")
    )
      autoSubmitBody = callback.body.getText(file).slice(1, -1);
  }
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(body);
assert.ok(startBody);
assert.ok(autoSubmitBody);
assert.ok(checkBody);

function submission(
  options: {
    selectFailure?: boolean;
    admissionFailure?: number;
    admissionCode?: string;
    consentFailure?: boolean;
    capabilitiesFailure?: Error;
    onAdmitted?: (admission: SentenceAnalysisAdmission) => void;
    prepare?: Promise<void>;
  } = {},
) {
  const counts = {
    uploads: 0,
    registrations: 0,
    selections: 0,
    submissions: 0,
    loaded: 0,
  };
  const sourceBlob = new Blob(["recorded WAV"], { type: "audio/wav" });
  const pending = { current: false };
  const busy = { current: false };
  let canCheck = false;
  let phase = "review";
  let error: string | null = null;
  let waits = 0;
  const noop = () => {};
  const deps = {
    submissionBusyRef: busy,
    mountedRef: { current: true },
    authEpochRef: { current: 1 },
    analysisPendingRef: pending,
    waitingAnalysisRef: { current: undefined },
    sessionIdRef: { current: 138 },
    checkExistingAnalysis: () => {
      throw new Error("Unexpected status read before admission");
    },
    recorder: { blob: sourceBlob, durationMs: 7000 },
    localOnly: false,
    onAnalysisAdmitted: options.onAdmitted,
    setRequestError: (value: string | null) => {
      error = value;
    },
    setRequestFailure: noop,
    setCanRetryAnalysis: noop,
    setCanCheckAnalysis: (value: boolean) => {
      canCheck = value;
    },
    setUploadProgress: noop,
    setPhase: (value: string) => {
      phase = value;
    },
    setRecordingAttempts: noop,
    selectedRecordingRef: { current: null },
    uploadedRecordingRef: { current: null },
    getAuthSessionVersion: () => 1,
    PracticeInputError,
    ApiError,
    analysisRequestWasRejected,
    getAnalysisCapabilities: async () => {
      if (options.capabilitiesFailure) throw options.capabilitiesFailure;
      return {
        minimumDurationMs: 1000,
        maximumDurationMs: 60000,
        acceptedAudioMimeTypes: ["audio/wav"],
        maximumAudioUploadBytes: 1_000_000,
      };
    },
    prepareAudioForAnalysis: async () => {
      await options.prepare;
      return { blob: sourceBlob, extension: "wav", mimeType: "audio/wav" };
    },
    ensureSession: async () => 138,
    uploadRecordingWithFreshUrl: async () => {
      counts.uploads++;
      return { objectKey: "uploaded.wav" };
    },
    waitForRecordingQuality: async () => ({
      qualityStatus: "PASS",
      selected: false,
    }),
    getConsentInput: async () => {
      if (options.consentFailure) throw new Error("policy unavailable");
      return { accepted: true, policyRevision: "current" };
    },
    api: {
      training: {
        registerRecording: async () => {
          counts.registrations++;
          return { recordingId: 104 };
        },
        selectRecording: async () => {
          counts.selections++;
          if (options.selectFailure && counts.selections === 1)
            throw new ApiError("잘못된 입력값입니다.", 400);
        },
        analyze: async () => {
          counts.submissions++;
          if (options.admissionFailure)
            throw new ApiError(
              "not accepted",
              options.admissionFailure,
              options.admissionCode,
            );
          return { analysisId: 20 };
        },
      },
    },
    waitForAnalysis: async () => {
      waits += 1;
      return { id: 20 };
    },
    loadResult: async () => {
      counts.loaded++;
    },
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const executable =
    ts.transpile(`async function run() {${body}}`, {
      target: ts.ScriptTarget.ES2022,
    }) + "\nreturn await run();";
  const execute = new AsyncFunction(...Object.keys(deps), executable);
  return {
    run: () => execute(...Object.values(deps)) as Promise<void>,
    counts,
    pending,
    busy,
    get phase() {
      return phase;
    },
    get error() {
      return error;
    },
    get recording() {
      return deps.recorder.blob;
    },
    get waits() {
      return waits;
    },
    get canCheck() {
      return canCheck;
    },
  };
}

test("sentence analysis advances only after the API acknowledges admission and does not wait for its result", async () => {
  const admissions: SentenceAnalysisAdmission[] = [];
  const attempt = submission({ onAdmitted: (value) => admissions.push(value) });
  await attempt.run();
  assert.deepEqual(admissions, [
    { sessionId: 138, recordingId: 104, analysisId: 20 },
  ]);
  assert.equal(attempt.counts.submissions, 1);
  assert.equal(attempt.waits, 0);
  assert.equal(attempt.counts.loaded, 0);
  assert.equal(attempt.pending.current, true);
});

test("a lost acknowledgement can advance after a status read without waiting for AI completion or resubmitting", async () => {
  const admissions: SentenceAnalysisAdmission[] = [];
  const noop = () => {};
  const deps = {
    sessionId: 138,
    setRequestError: noop,
    setRequestFailure: noop,
    setCanCheckAnalysis: noop,
    setPhase: noop,
    waitingAnalysisRef: { current: undefined },
    selectedRecordingRef: { current: 104 },
    analysisPendingRef: { current: true },
    analysisAdmissionMissing,
    api: {
      training: {
        get: async () => ({ status: "ANALYZING", analysisAvailable: false }),
      },
    },
    canonicalApi: {
      status: async () => ({ analysisId: 20, status: "PROCESSING" }),
    },
    onAnalysisAdmitted: (value: SentenceAnalysisAdmission) =>
      admissions.push(value),
    ApiError,
    waitForAnalysis: () => {
      throw new Error(
        "Should not wait for the result before the next sentence",
      );
    },
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction(
    ...Object.keys(deps),
    ts.transpile(`async function run() {${checkBody}}`, {
      target: ts.ScriptTarget.ES2022,
    }) + "\nreturn await run();",
  );
  await execute(...Object.values(deps));
  assert.deepEqual(admissions, [
    { sessionId: 138, recordingId: 104, analysisId: 20 },
  ]);
});

test("a finalized sentence automatically submits exactly once and does not retry on error rerenders", () => {
  let submitted = 0;
  const recorder = { status: "recorded", blob: new Blob(["sentence one"]) };
  const submittedBlob = { current: null as Blob | null };
  const execute = new Function(
    "autoSubmit",
    "phase",
    "recorder",
    "autoSubmittedBlobRef",
    "analyze",
    "capturedRecording",
    "retryOwner",
    "submissionRetry",
    ts.transpile(`function run() {${autoSubmitBody}}`, {
      target: ts.ScriptTarget.ES2022,
    }) + "\nreturn run();",
  );
  const run = (phase = "review") =>
    execute(
      true,
      phase,
      recorder,
      submittedBlob,
      () => {
        submitted += 1;
      },
      undefined,
      { current: 0 },
      0,
    );
  run("recording");
  assert.equal(submitted, 0);
  run();
  run();
  assert.equal(submitted, 1);
  recorder.blob = new Blob(["sentence two"]);
  recorder.status = "stopping";
  run();
  assert.equal(submitted, 1);
  recorder.status = "recorded";
  run();
  assert.equal(submitted, 2);
});

test("a rejected sentence admission cannot advance the sequence", async () => {
  let advanced = false;
  const attempt = submission({
    admissionFailure: 503,
    admissionCode: "ANALYSIS_INTEGRATION_UNAVAILABLE",
    onAdmitted: () => {
      advanced = true;
    },
  });
  await attempt.run();
  assert.equal(advanced, false);
  assert.equal(attempt.pending.current, false);
  assert.ok(attempt.recording);
});

test("a concurrency limit rejection retains the sentence upload for admission retry", async () => {
  let advanced = false;
  const attempt = submission({
    admissionFailure: 429,
    admissionCode: "ANALYSIS_CONCURRENT_LIMIT_EXCEEDED",
    onAdmitted: () => {
      advanced = true;
    },
  });
  await attempt.run();
  assert.equal(advanced, false);
  assert.equal(attempt.pending.current, false);
  assert.equal(attempt.canCheck, false);
  await attempt.run();
  assert.equal(attempt.counts.uploads, 1);
  assert.equal(attempt.counts.registrations, 1);
});

test("class microphone capture does not depend on remote analysis support or availability", async () => {
  const calls: string[] = [];
  let phase = "idle";
  const deps = {
    recorder: {
      unlockAudio: () => calls.push("unlock"),
      start: async () => {
        calls.push("microphone");
        return true;
      },
    },
    sentenceBoundaries: { current: [3] },
    setActiveSentence: () => {},
    setRequestError: () => {},
    setRequestFailure: () => {},
    setPhase: (value: string) => {
      phase = value;
    },
    localOnly: false,
    getAnalysisCapabilities: async () => {
      calls.push("server");
      throw new ApiError(
        "Class analysis unsupported",
        409,
        "COURSE_ANALYSIS_UNSUPPORTED",
      );
    },
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction(
    ...Object.keys(deps),
    ts.transpile(`async function run() {${startBody}}`, {
      target: ts.ScriptTarget.ES2022,
    }) + "\nreturn await run();",
  );
  const started = execute(...Object.values(deps));
  assert.deepEqual(calls, ["unlock", "microphone"]);
  await started;
  assert.equal(phase, "recording");
  assert.deepEqual(deps.sentenceBoundaries.current, [0]);
});

for (const failure of [
  new ApiError(
    "Class analysis unsupported",
    409,
    "COURSE_ANALYSIS_UNSUPPORTED",
  ),
  new PracticeInputError("unsupported", "Intonation analysis unsupported"),
  new ApiError("Analysis offline", 503, "ANALYSIS_INTEGRATION_UNAVAILABLE"),
]) {
  test(`${failure.message} keeps the recording review playable and blocks upload`, async () => {
    const attempt = submission({ capabilitiesFailure: failure });
    const recording = attempt.recording;
    await attempt.run();
    assert.equal(attempt.phase, "review");
    assert.equal(attempt.error, failure.message);
    assert.equal(attempt.recording, recording);
    assert.equal(attempt.counts.uploads, 0);
    assert.equal(attempt.counts.registrations, 0);
    assert.equal(attempt.counts.submissions, 0);
    assert.equal(attempt.pending.current, false);
    assert.equal(attempt.busy.current, false);
  });
}

test("select failure keeps the uploaded recording and does not start status polling", async () => {
  const attempt = submission({ selectFailure: true });
  await attempt.run();
  assert.equal(attempt.pending.current, false);
  assert.equal(attempt.canCheck, false);
  assert.equal(attempt.counts.submissions, 0);
  await attempt.run();
  assert.deepEqual(attempt.counts, {
    uploads: 1,
    registrations: 1,
    selections: 2,
    submissions: 1,
    loaded: 1,
  });
});

test("rapid analysis clicks cannot upload or submit twice", async () => {
  let release!: () => void;
  const prepare = new Promise<void>((resolve) => {
    release = resolve;
  });
  const attempt = submission({ prepare });
  const first = attempt.run();
  await attempt.run();
  release();
  await first;
  assert.equal(attempt.counts.uploads, 1);
  assert.equal(attempt.counts.submissions, 1);
  assert.equal(attempt.busy.current, false);
});

for (const status of [400, 401, 403, 404, 422]) {
  test(`rejected analysis ${status} does not offer polling for a nonexistent analysis`, async () => {
    const attempt = submission({ admissionFailure: status });
    await attempt.run();
    assert.equal(attempt.pending.current, false);
    assert.equal(attempt.canCheck, false);
  });
}

test("lost admission acknowledgment retains the recording and offers a read before resubmission", async () => {
  const attempt = submission({ admissionFailure: 503 });
  await attempt.run();
  assert.equal(attempt.pending.current, true);
  assert.equal(attempt.canCheck, true);
});

test("a definite unavailable admission can retry the retained upload without polling or uploading again", async () => {
  const attempt = submission({
    admissionFailure: 503,
    admissionCode: "ANALYSIS_INTEGRATION_UNAVAILABLE",
  });
  await attempt.run();
  assert.equal(attempt.pending.current, false);
  assert.equal(attempt.canCheck, false);
  await attempt.run();
  assert.equal(attempt.counts.uploads, 1);
  assert.equal(attempt.counts.registrations, 1);
  assert.equal(attempt.counts.submissions, 2);
});

test("failed consent preparation never marks an analysis as submitted", async () => {
  const attempt = submission({ consentFailure: true });
  await attempt.run();
  assert.equal(attempt.counts.submissions, 0);
  assert.equal(attempt.pending.current, false);
  assert.equal(attempt.canCheck, false);
});

test("only explicit server confirmation permits recovery from missing analysis admission", () => {
  for (const status of ["RECORDING", "UPLOADING"] as const) {
    const session = { status, analysisAvailable: false } as TrainingSession;
    assert.equal(analysisAdmissionMissing(session), true);
    assert.equal(analysisAdmissionMissing(session, 20), false);
    assert.equal(
      analysisAdmissionMissing({ ...session, analysisAvailable: true }),
      false,
    );
    assert.equal(
      analysisAdmissionMissing({ status } as TrainingSession),
      false,
    );
  }
  for (const status of [
    "ANALYZING",
    "COMPLETED",
    "FAILED",
    "CANCELED",
  ] as const) {
    assert.equal(
      analysisAdmissionMissing({
        status,
        analysisAvailable: false,
      } as TrainingSession),
      false,
    );
  }
});
