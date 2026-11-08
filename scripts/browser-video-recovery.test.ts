import assert from "node:assert/strict";
import test from "node:test";
import { BrowserVideoPracticeAttempt } from "../src/lib/browser-video-practice";
import { practiceRecoveryStore } from "../src/lib/practice-recovery-store";
import { markAuthenticatedUser } from "../src/lib/auth-session";
import { api } from "../src/lib/api";
import { ApiError, saveAccessToken } from "../src/lib/api/client";
import type { UserAccount } from "../src/lib/api/types";

for (const scenario of [
  "lost-session",
  "lost-job",
  "unavailable",
  "known-job-missing",
  "changed-job",
]) {
  test(`video ${scenario}: retained file/request/job identity survives restoration without fresh inference`, async () => {
    const originals = {
      fetch: globalThis.fetch,
      read: practiceRecoveryStore.read,
      write: practiceRecoveryStore.write,
      create: api.training.create,
      content: api.content.createCustom,
    };
    let stored: unknown;
    const sessionKeys: string[] = [];
    let contentCount = 0,
      sessionCount = 0,
      jobCount = 0,
      round = 0;
    let sessionCreated = false,
      jobCreated = false;
    let clientRequestId = "";
    const clip = {
      blob: new Blob(["exact original video"], { type: "video/webm" }),
      url: "blob:fixture",
      durationMs: 7000,
      hasAudioTrack: true,
      promptIndex: 0,
    };
    const script = "영상 복구 연습";
    saveAccessToken("fixture");
    markAuthenticatedUser({ id: 1, onboardingCompleted: true } as UserAccount);
    practiceRecoveryStore.read = async <T>() =>
      structuredClone(stored) as T | undefined;
    practiceRecoveryStore.write = async (_user, _scope, record) => {
      stored = structuredClone(record);
    };
    api.content.createCustom = (async () => {
      assert.ok(stored);
      contentCount++;
      return { id: 183 };
    }) as typeof api.content.createCustom;
    api.training.create = (async (_body, key) => {
      assert.ok(stored);
      assert.ok(key);
      sessionKeys.push(key);
      if (!sessionCreated) {
        sessionCreated = true;
        sessionCount++;
        if (scenario === "lost-session")
          throw new ApiError("lost acknowledgement", 0);
      }
      return { sessionId: 77 };
    }) as typeof api.training.create;
    const job = () => ({
      schemaVersion: "voice-coaching.independent-audiovisual.v1",
      jobId:
        round > 0 && scenario === "changed-job"
          ? "00000000-0000-4000-8000-000000000099"
          : "00000000-0000-4000-8000-000000000001",
      executionId: "00000000-0000-4000-8000-000000000002",
      clientRequestId,
      status: "FAILED",
      sequence: 1,
      uploaded: ["source"],
      resultAvailable: false,
      resultSha256: null,
      failure: { code: "EXECUTION_INTERRUPTED" },
    });
    globalThis.fetch = async (input, options) => {
      const url = String(input);
      if (url.includes("video-analysis-upload-grants")) {
        const body = JSON.parse(String(options?.body));
        clientRequestId = body.clientRequestId;
        return Response.json({
          result: true,
          data: {
            schemaVersion: "voice-coaching.browser-video-grant.v1",
            aiBaseUrl: "https://ai.invalid",
            jobsPath: "/browser/v1/video-analysis-jobs",
            grantToken: "ephemeral-fixture-only",
            expiresAt: Math.floor(Date.now() / 1000) + 300,
            metadata: {
              clientRequestId,
              scriptText: script,
              contentId: 183,
              source: body.source,
            },
          },
        });
      }
      if (options?.method === "POST") {
        jobCount++;
        jobCreated = true;
        if (round === 0 && scenario === "lost-job")
          throw new Error("lost AI acknowledgement");
        return Response.json(job());
      }
      if (round === 0 && scenario === "unavailable")
        return Response.json({}, { status: 503 });
      if ((round > 0 && scenario === "known-job-missing") || !jobCreated)
        return Response.json({}, { status: 404 });
      return Response.json(job());
    };
    try {
      const attempt = new BrowserVideoPracticeAttempt(
        clip,
        script,
        "영상 연습",
        "video-fixture",
      );
      const progress = () => ({
        signal: new AbortController().signal,
        onPhase() {},
        onJob() {},
      });
      await assert.rejects(() => attempt.run(true, progress()));
      const firstRequestId = attempt.clientRequestId;
      round++;
      const restored = await BrowserVideoPracticeAttempt.restore(
        "video-fixture",
        script,
      );
      assert.ok(restored);
      assert.equal(restored.clientRequestId, firstRequestId);
      assert.equal(await restored.clip.blob.text(), "exact original video");
      await assert.rejects(() => restored.run(true, progress()));
      assert.equal(contentCount, 1);
      assert.equal(sessionCount, 1);
      assert.ok(sessionKeys.every((key) => key === sessionKeys[0]));
      assert.equal(jobCount, 1);
      const serialized = JSON.stringify(stored);
      assert.ok(!serialized.includes("ephemeral-fixture-only"));
      assert.ok(!serialized.includes("blob:fixture"));
      URL.revokeObjectURL(restored.clip.url);
    } finally {
      globalThis.fetch = originals.fetch;
      practiceRecoveryStore.read = originals.read;
      practiceRecoveryStore.write = originals.write;
      api.training.create = originals.create;
      api.content.createCustom = originals.content;
    }
  });
}
