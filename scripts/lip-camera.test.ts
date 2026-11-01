import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  assertCoachingInput,
  coachingLimitNotice,
} from "../src/lib/coaching-usage";
import { analysisRequestWasRejected } from "../src/lib/canonical-recovery";

const source = readFileSync("src/routes/lip-practice.tsx", "utf8");
const file = ts.createSourceFile(
  "lip-practice.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let body = "";
function find(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "requestMedia") {
    body = node.body!.getText(file).slice(1, -1);
  }
  ts.forEachChild(node, find);
}
find(file);
assert.ok(body, "camera request handler exists");

async function requestCamera(
  getUserMedia: (constraints: unknown) => Promise<unknown>,
) {
  const steps: string[] = [];
  const errors: (string | null)[] = [];
  const streamRef = { current: null };
  const mediaBusy = { current: false };
  const dependencies = {
    mediaBusy,
    mounted: { current: true },
    mediaRequest: { current: 0 },
    setStep: (step: string) => steps.push(step),
    setError: (error: string | null) => errors.push(error),
    navigator: { mediaDevices: { getUserMedia } },
    streamRef,
    audioContextRef: { current: null },
    AudioContext: class {
      state = "running";
      async resume() {}
    },
    releaseLipResources: () => {},
    requireAnalysisScope: () => {
      throw new Error("Video analysis is unavailable");
    },
    DOMException,
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(...Object.keys(dependencies), body)(
    ...Object.values(dependencies),
  );
  return { steps, errors, streamRef, mediaBusy };
}

test("local camera practice opens even when server video analysis is unavailable", async () => {
  const stream = { getTracks: () => [] };
  const result = await requestCamera(async (constraints) => {
    assert.deepEqual(constraints, {
      video: { facingMode: "user", width: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    return stream;
  });
  assert.deepEqual(result.steps, ["permission", "align"]);
  assert.deepEqual(result.errors, [null]);
  assert.equal(result.streamRef.current, stream);
  assert.equal(result.mediaBusy.current, false);
});

test("camera permission denial remains retryable and shows an error", async () => {
  const result = await requestCamera(async () => {
    throw new DOMException("Denied", "NotAllowedError");
  });
  assert.deepEqual(result.steps, ["permission"]);
  assert.match(result.errors[1]!, /카메라와 마이크 권한/);
  assert.equal(result.mediaBusy.current, false);
});

test("a single reviewed clip can open the result screen and submit audio immediately", () => {
  let handler = "";
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "analyzeCurrentClip"
    )
      handler = node.body!.getText(file).slice(1, -1);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(handler);
  let submitted = false;
  let step = "review";
  let released = false;
  const streamRef = { current: { getTracks: () => [] } as unknown };
  const dependencies = {
    currentClip: { promptIndex: 0, audioBlob: new Blob(["audio"]) },
    analysisBusyRef: { current: false },
    streamRef,
    releaseLipResources: () => {
      released = true;
    },
    setStep: (value: string) => {
      step = value;
    },
    analyzeSelectedClip: () => {
      submitted = true;
    },
  };
  new Function(...Object.keys(dependencies), handler)(
    ...Object.values(dependencies),
  );
  assert.equal(step, "complete");
  assert.equal(submitted, true);
  assert.equal(released, true);
  assert.equal(streamRef.current, null);
});

test("lip analysis submits captured audio through authenticated coaching admission", async () => {
  let analysisBody = "";
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "analyzeSelectedClip"
    )
      analysisBody = node.body!.getText(file).slice(1, -1);
    ts.forEachChild(node, visit);
  }
  visit(file);
  const audio = new Blob(["wav"], { type: "audio/wav" });
  const video = new Blob(["video"], { type: "video/mp4" });
  let submitted = 0;
  const noop = () => {};
  const dependencies = {
    reportClip: { blob: video, audioBlob: audio, durationMs: 7000 },
    analysisBusyRef: { current: false },
    mounted: { current: true },
    videoConsentAccepted: true,
    analysisOwnerRef: { current: null },
    submittedClipsRef: { current: new Set<Blob>() },
    AbortController,
    DOMException,
    crypto: globalThis.crypto,
    getAuthSessionVersion: () => 1,
    setAnalysisPhase: noop,
    setAnalysisTarget: noop,
    setAnalysisError: noop,
    setUploadProgress: noop,
    setAnalysisProgress: noop,
    selectedClip: 0,
    prompts: ["연습 문장"],
    prepareAudioForAnalysis: async (source: Blob) => {
      assert.equal(source, audio);
      return { blob: audio, mimeType: "audio/wav", extension: "wav" };
    },
    contentByPromptRef: { current: new Map() },
    api: {
      content: { createCustom: async () => ({ id: 1 }) },
      training: {
        getAnalysisCapabilities: async () => ({
          recordingUpload: "CONFIGURED",
          analysisRequests: "CONFIGURED",
          supportedLearningFocuses: ["PRONUNCIATION"],
          consentPolicyRevision: "current-policy",
          minimumDurationMs: 1000,
          maximumDurationMs: 90000,
          maximumAudioUploadBytes: 1000000,
          acceptedAudioMimeTypes: ["audio/wav"],
        }),
        create: async () => ({ sessionId: 2 }),
        getUploadUrl: async () => ({ objectKey: "audio.wav" }),
        uploadRecording: async (_upload: unknown, blob: Blob) => {
          assert.equal(blob, audio);
          assert.notEqual(blob, video);
        },
        registerRecording: async () => ({ recordingId: 3 }),
        listRecordings: async () => [{ recordingId: 3, qualityStatus: "PASS" }],
        selectRecording: async () => {},
      },
    },
    canonicalApi: {
      analyzeAudiovisual: async (sessionId: number, consent: unknown) => {
        assert.equal(sessionId, 2);
        assert.deepEqual(consent, {
          accepted: true,
          policyRevision: "current-policy",
        });
        submitted++;
        return { analysisId: 4 };
      },
    },
    waitForCanonicalResult: async () => {
      throw new Error("Stopped after verifying admission");
    },
    uploadRecordingWithFreshUrl: async (input: {
      issueUploadUrl: () => Promise<unknown>;
      upload: (info: unknown) => Promise<void>;
    }) => {
      const info = await input.issueUploadUrl();
      await input.upload(info);
      return info;
    },
    requireAnalysisScope: async () => {},
    invalidatesCanonicalResult: () => false,
    assertCoachingInput,
    coachingLimitNotice,
    analysisRequestWasRejected,
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const executable =
    ts.transpile(`async function run() {${analysisBody}}`, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    }) + "\nreturn await run();";
  const execute = new AsyncFunction(...Object.keys(dependencies), executable);
  await execute(...Object.values(dependencies));
  assert.equal(submitted, 1);
  await execute(...Object.values(dependencies));
  assert.equal(
    submitted,
    1,
    "an existing admission must not create a second billed analysis",
  );
});
