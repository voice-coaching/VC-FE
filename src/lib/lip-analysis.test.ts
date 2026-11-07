import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_LIP_CONSENT,
  hasLipProcessingConsent,
  prepareLipAnalysis,
  uploadLipRecording,
} from "./lip-analysis";
import type {
  AnalysisCapabilities,
  ApiContract,
  VoiceRecording,
} from "./api/types";
import type { LipClip } from "./lip-practice";

const capabilities: AnalysisCapabilities = {
  recordingUpload: "CONFIGURED",
  analysisRequests: "CONFIGURED",
  supportedLearningFocuses: ["PRONUNCIATION"],
  acceptedAudioMimeTypes: ["audio/*"],
  acceptedVideoMimeTypes: ["video/*"],
  maximumAudioUploadBytes: 1000,
  maximumVideoUploadBytes: 10000,
  minimumDurationMs: 1000,
  maximumDurationMs: 90000,
  videoRequiresAudioTrack: true,
  voiceProcessingConsentRequired: true,
  videoProcessingConsentRequired: true,
  consentPolicyRevision: "voice-v1",
  videoProcessingConsentPolicyRevision: "video-v1",
};
const consent = {
  voicePolicyRevision: "voice-v1",
  videoPolicyRevision: "video-v1",
};
const clip: LipClip = {
  promptIndex: 0,
  blob: new Blob(["real video bytes"], { type: "video/webm;codecs=vp8,opus" }),
  hasAudioTrack: true,
  durationMs: 7000,
  url: "blob:test",
};

test("video bytes/MIME and registration consent stay separate from the analysis voice consent", async () => {
  const prepared = prepareLipAnalysis(clip, "연습 문장", capabilities, consent);
  assert.equal(await prepared.blob.text(), await clip.blob.text());
  assert.equal(prepared.mimeType, "video/webm");
  assert.equal(prepared.extension, "webm");
  assert.deepEqual(prepared.analysisConsent, {
    accepted: true,
    policyRevision: "voice-v1",
  });
  assert.deepEqual(prepared.recordingConsent, {
    videoProcessingConsentAccepted: true,
    videoProcessingConsentPolicyRevision: "video-v1",
  });
});

test("old audio-only acceptance, changed policies and missing required revisions cannot authorize video", () => {
  assert.equal(
    hasLipProcessingConsent(capabilities, {
      ...EMPTY_LIP_CONSENT,
      voicePolicyRevision: "voice-v1",
    }),
    false,
  );
  for (const policy of [
    { ...capabilities, videoProcessingConsentPolicyRevision: "video-v2" },
    { ...capabilities, consentPolicyRevision: "voice-v2" },
    { ...capabilities, videoProcessingConsentPolicyRevision: null },
  ])
    assert.throws(
      () => prepareLipAnalysis(clip, "연습", policy, consent),
      /정책/,
    );
});

test("disabled consent policies add neither an acceptance nor a fabricated revision", () => {
  const prepared = prepareLipAnalysis(
    clip,
    "연습",
    {
      ...capabilities,
      voiceProcessingConsentRequired: false,
      videoProcessingConsentRequired: false,
      consentPolicyRevision: null,
      videoProcessingConsentPolicyRevision: null,
    },
    EMPTY_LIP_CONSENT,
  );
  assert.equal(prepared.analysisConsent, undefined);
  assert.deepEqual(prepared.recordingConsent, {});
});

test("video admission validates MIME, bytes, duration, audio track and malformed limits before writes", () => {
  const cases: [LipClip, AnalysisCapabilities][] = [
    [
      { ...clip, blob: new Blob(["audio"], { type: "audio/wav" }) },
      capabilities,
    ],
    [{ ...clip, blob: new Blob([], { type: "video/webm" }) }, capabilities],
    [clip, { ...capabilities, maximumVideoUploadBytes: 1 }],
    [
      { ...clip, blob: new Blob(["unknown"]) },
      { ...capabilities, acceptedVideoMimeTypes: ["*/*"] },
    ],
    [
      { ...clip, blob: new Blob(["audio"], { type: "audio/wav" }) },
      { ...capabilities, acceptedVideoMimeTypes: ["*/*"] },
    ],
    [{ ...clip, durationMs: 500 }, capabilities],
    [{ ...clip, durationMs: 91000 }, capabilities],
    [{ ...clip, hasAudioTrack: false }, capabilities],
    [clip, { ...capabilities, maximumVideoUploadBytes: NaN }],
    [clip, { ...capabilities, recordingUpload: "NOT_CONFIGURED" }],
  ];
  for (const [input, policy] of cases)
    assert.throws(() => prepareLipAnalysis(input, "연습", policy, consent));
});

function transport(mediaType = "AUDIO_VISUAL") {
  const calls: string[] = [];
  const controller = new AbortController();
  const prepared = prepareLipAnalysis(clip, "연습", capabilities, consent);
  const training = {
    getUploadUrl: async (_id: unknown, input: unknown) => {
      calls.push("url");
      assert.equal((input as { mimeType: string }).mimeType, "video/webm");
      return {
        objectKey: "video.webm",
        uploadUrl: "https://storage.example.invalid/video.webm",
      };
    },
    uploadRecording: async (
      _upload: unknown,
      blob: Blob,
      _progress: unknown,
      signal: AbortSignal,
    ) => {
      calls.push("upload");
      assert.equal(blob, prepared.blob);
      assert.equal(await blob.text(), await clip.blob.text());
      assert.equal(signal, controller.signal);
    },
    registerRecording: async (_id: unknown, input: unknown) => {
      calls.push("register");
      assert.deepEqual(input, {
        objectKey: "video.webm",
        mimeType: "video/webm",
        fileSizeBytes: clip.blob.size,
        durationMs: 7000,
        videoProcessingConsentAccepted: true,
        videoProcessingConsentPolicyRevision: "video-v1",
      });
      return { recordingId: 3, analysisMediaType: mediaType };
    },
    listRecordings: async () => {
      calls.push("quality");
      return [
        { recordingId: 3, qualityStatus: "PASS", analysisMediaType: mediaType },
      ];
    },
    selectRecording: async (_session: unknown, id: unknown) => {
      calls.push("select");
      assert.equal(id, 3);
    },
  } as unknown as ApiContract["training"];
  const options = {
    sessionId: 2,
    clip,
    prepared,
    signal: controller.signal,
    requireActive: () => controller.signal.throwIfAborted(),
    onProgress: () => {},
  };
  return { calls, controller, training, options };
}

test("upload registers and selects the matching audiovisual recording", async () => {
  const run = transport();
  assert.equal(await uploadLipRecording(run.options, run.training), 3);
  assert.deepEqual(run.calls, [
    "url",
    "upload",
    "register",
    "quality",
    "select",
  ]);
});

test("a backend audio-only recording is never selected for audiovisual analysis", async () => {
  const run = transport("AUDIO_ONLY");
  await assert.rejects(
    uploadLipRecording(run.options, run.training),
    /영상으로 등록/,
  );
  assert.deepEqual(run.calls, ["url", "upload", "register"]);
});

test("cancellation after upload cannot register or select a new recording", async () => {
  const run = transport();
  run.training.uploadRecording = async () => {
    run.controller.abort();
  };
  await assert.rejects(uploadLipRecording(run.options, run.training), {
    name: "AbortError",
  });
  assert.deepEqual(run.calls, ["url"]);
});

test("quality failure never selects a different recording or submits analysis", async () => {
  const run = transport();
  run.training.listRecordings = async () =>
    [
      { recordingId: 999, qualityStatus: "PASS" },
      { recordingId: 3, qualityStatus: "TOO_SHORT" },
    ] as VoiceRecording[];
  await assert.rejects(uploadLipRecording(run.options, run.training), /품질/);
  assert.equal(run.calls.includes("select"), false);
});
