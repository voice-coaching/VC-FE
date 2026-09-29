import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  ApiError,
  clearAccessToken,
  saveAccessToken,
} from "../src/lib/api/client";
import { createRemoteApi } from "../src/lib/api/remote";
import type { RecordingUploadUrl } from "../src/lib/api/types";
import { uploadRecordingWithFreshUrl } from "../src/lib/recording-upload";

const originalXMLHttpRequest = globalThis.XMLHttpRequest;

class FakeXMLHttpRequest {
  static nextStatus = 204;
  static latest: FakeXMLHttpRequest | null = null;

  readonly headers = new Headers();
  readonly upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
    onprogress: null,
  };
  method = "";
  url = "";
  status = 0;
  timeout = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  constructor() {
    FakeXMLHttpRequest.latest = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  send() {
    this.status = FakeXMLHttpRequest.nextStatus;
    this.onload?.();
  }
}

function installFakeXMLHttpRequest(status = 204) {
  FakeXMLHttpRequest.nextStatus = status;
  FakeXMLHttpRequest.latest = null;
  globalThis.XMLHttpRequest =
    FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;
}

afterEach(() => {
  clearAccessToken();
  globalThis.XMLHttpRequest = originalXMLHttpRequest;
});

function uploadInfo(id: number): RecordingUploadUrl {
  return {
    objectKey: `recordings/${id}.m4a`,
    uploadUrl: `https://storage.example.test/${id}`,
    expiresAt: "2026-09-29T00:00:00Z",
    requiredHeaders: { "Content-Type": "audio/mp4" },
  };
}

test("a rejected direct upload gets one fresh URL and returns its object key", async () => {
  let issued = 0;
  let uploaded = 0;
  let retries = 0;
  const result = await uploadRecordingWithFreshUrl({
    issueUploadUrl: async () => uploadInfo(++issued),
    upload: async () => {
      uploaded += 1;
      if (uploaded === 1) {
        throw new ApiError("rejected", 401, "UPLOAD_AUTHORIZATION_FAILED");
      }
    },
    onRetry: () => {
      retries += 1;
    },
  });

  assert.equal(issued, 2);
  assert.equal(uploaded, 2);
  assert.equal(retries, 1);
  assert.equal(result.objectKey, "recordings/2.m4a");
});

test("ordinary API auth failures are not mistaken for direct-upload failures", async () => {
  let issued = 0;
  await assert.rejects(
    uploadRecordingWithFreshUrl({
      issueUploadUrl: async () => uploadInfo(++issued),
      upload: async () => {
        throw new ApiError("expired login", 401, "API_ERROR");
      },
    }),
    (reason: unknown) =>
      reason instanceof ApiError && reason.code === "API_ERROR",
  );
  assert.equal(issued, 1);
});

test("relative backend upload URLs go through the proxy with the access token", async () => {
  installFakeXMLHttpRequest();
  saveAccessToken("current-token");

  await createRemoteApi("/api/backend").training.uploadRecording(
    { ...uploadInfo(1), uploadUrl: "/api/recordings/upload/1" },
    new Blob(["voice"], { type: "audio/mp4" }),
  );

  assert.equal(FakeXMLHttpRequest.latest?.method, "PUT");
  assert.equal(
    FakeXMLHttpRequest.latest?.url,
    "/api/backend/api/recordings/upload/1",
  );
  assert.equal(
    FakeXMLHttpRequest.latest?.headers.get("Authorization"),
    "Bearer current-token",
  );
});

test("access tokens are never sent to an external presigned URL", async () => {
  installFakeXMLHttpRequest();
  saveAccessToken("must-not-leak");

  await createRemoteApi("/api/backend").training.uploadRecording(
    uploadInfo(1),
    new Blob(["voice"], { type: "audio/mp4" }),
  );

  assert.equal(
    FakeXMLHttpRequest.latest?.url,
    "https://storage.example.test/1",
  );
  assert.equal(FakeXMLHttpRequest.latest?.headers.get("Authorization"), null);
});

test("an absolute upload endpoint on the configured backend keeps auth", async () => {
  installFakeXMLHttpRequest();
  saveAccessToken("backend-token");

  await createRemoteApi(
    "https://api.example.test/api",
  ).training.uploadRecording(
    {
      ...uploadInfo(1),
      uploadUrl: "https://api.example.test/api/recordings/upload/1",
    },
    new Blob(["voice"], { type: "audio/mp4" }),
  );

  assert.equal(
    FakeXMLHttpRequest.latest?.headers.get("Authorization"),
    "Bearer backend-token",
  );
});

test("storage 401 is identified as an upload authorization failure", async () => {
  installFakeXMLHttpRequest(401);

  await assert.rejects(
    createRemoteApi("/api/backend").training.uploadRecording(
      uploadInfo(1),
      new Blob(["voice"], { type: "audio/mp4" }),
    ),
    (reason: unknown) =>
      reason instanceof ApiError &&
      reason.status === 401 &&
      reason.code === "UPLOAD_AUTHORIZATION_FAILED",
  );
});
