import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { coachingLimitNotice } from "../src/lib/coaching-usage";
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
    setRequestingMedia: () => {},
    setPermission: () => {},
    setError: (error: string | null) => errors.push(error),
    navigator: { mediaDevices: { getUserMedia } },
    streamRef,
    releaseLipResources: () => {},
    requireAnalysisScope: () => {
      throw new Error("Video analysis is unavailable");
    },
    DOMException,
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const executable =
    ts.transpile(`async function run() {${body}}`, {
      target: ts.ScriptTarget.ES2022,
    }) + "\nreturn await run();";
  await new AsyncFunction(...Object.keys(dependencies), executable)(
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
  assert.deepEqual(result.steps, ["align"]);
  assert.deepEqual(result.errors, [null]);
  assert.equal(result.streamRef.current, stream);
  assert.equal(result.mediaBusy.current, false);
});

test("camera permission denial remains retryable and shows an error", async () => {
  const result = await requestCamera(async () => {
    throw new DOMException("Denied", "NotAllowedError");
  });
  assert.deepEqual(result.steps, []);
  assert.match(result.errors[1]!, /카메라와 마이크 권한/);
  assert.equal(result.mediaBusy.current, false);
});

test("a single reviewed clip can open the result screen and request analysis immediately", () => {
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

test("camera results explicitly enable video feedback", () => {
  assert.match(
    source,
    /<DirectAnalysisResult[\s\S]*?isCameraPractice[\s\S]*?\/>/,
  );
  assert.match(source, /<AnalysisView[\s\S]*?isCameraPractice[\s\S]*?\/>/);
});

test("lip analysis submits captured video once through authenticated coaching admission", async () => {
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
  const video = new Blob(["video"], { type: "video/mp4" });
  let submitted = 0;
  const noop = () => {};
  const dependencies = {
    reportClip: { blob: video, hasAudioTrack: true, durationMs: 7000 },
    analysisBusyRef: { current: false },
    mounted: { current: true },
    processingConsent: {
      voicePolicyRevision: "current-policy",
      videoPolicyRevision: "video-policy",
    },
    setVideoCapabilities: noop,
    analysisOwnerRef: { current: null },
    submittedClipsRef: { current: new Set<Blob>() },
    setSubmittedPrompts: noop,
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
    loadLipAnalysisCapabilities: async () => ({}),
    prepareLipAnalysis: (clip: { blob: Blob }) => {
      assert.equal(clip.blob, video);
      return {
        blob: video,
        mimeType: "video/mp4",
        extension: "mp4",
        analysisConsent: { accepted: true, policyRevision: "current-policy" },
      };
    },
    uploadLipRecording: async (options: {
      clip: { blob: Blob };
      prepared: { blob: Blob };
    }) => {
      assert.equal(options.clip.blob, video);
      assert.equal(options.prepared.blob, video);
      return 3;
    },
    contentByPromptRef: { current: new Map() },
    api: {
      content: { createCustom: async () => ({ id: 1 }) },
      training: { create: async () => ({ sessionId: 2 }) },
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
    invalidatesCanonicalResult: () => false,
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
