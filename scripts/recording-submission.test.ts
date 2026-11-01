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

const source = readFileSync("src/components/practice-session.tsx", "utf8");
const file = ts.createSourceFile(
  "practice-session.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let body = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "analyze")
    body = node.body!.getText(file).slice(1, -1);
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(body);

function submission(
  options: {
    selectFailure?: boolean;
    admissionFailure?: number;
    admissionCode?: string;
    consentFailure?: boolean;
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
  const noop = () => {};
  const deps = {
    submissionBusyRef: busy,
    analysisPendingRef: pending,
    waitingAnalysisRef: { current: undefined },
    sessionIdRef: { current: 138 },
    checkExistingAnalysis: () => {
      throw new Error("Unexpected status read before admission");
    },
    recorder: { blob: sourceBlob, durationMs: 7000 },
    localOnly: false,
    setRequestError: noop,
    setRequestFailure: noop,
    setCanRetryAnalysis: noop,
    setCanCheckAnalysis: (value: boolean) => {
      canCheck = value;
    },
    setUploadProgress: noop,
    setPhase: noop,
    setRecordingAttempts: noop,
    selectedRecordingRef: { current: null },
    uploadedRecordingRef: { current: null },
    getAuthSessionVersion: () => 1,
    PracticeInputError,
    ApiError,
    analysisRequestWasRejected,
    getAnalysisCapabilities: async () => ({
      minimumDurationMs: 1000,
      maximumDurationMs: 60000,
      acceptedAudioMimeTypes: ["audio/wav"],
      maximumAudioUploadBytes: 1_000_000,
    }),
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
    waitForAnalysis: async () => ({ id: 20 }),
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
    get canCheck() {
      return canCheck;
    },
  };
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
