import assert from "node:assert/strict";
import test from "node:test";
import {
  AnalysisFailed,
  AnalysisConnectionUnavailable,
  AnalysisWaitTimeout,
  pollAnalysis,
} from "../src/lib/analysis-polling";
import { ApiError } from "../src/lib/api/client";
import type { AnalysisProgress } from "../src/lib/api/types";

const pending: AnalysisProgress = {
  analysisId: 12,
  status: "PROCESSING",
  stage: "ANALYZING",
  progressPercent: 70,
  failureReason: null,
  updatedAt: "",
};

test("a stalled request is bounded by elapsed time", async () => {
  await assert.rejects(
    pollAnalysis({
      getStatus: () => new Promise(() => {}),
      onProgress: () => {},
      timeoutMs: 20,
    }),
    AnalysisWaitTimeout,
  );
});

test("70 percent cannot be mistaken for a completed result", async () => {
  const progress: number[] = [];
  await assert.rejects(
    pollAnalysis({
      getStatus: async () => pending,
      onProgress: (value) => progress.push(value),
      timeoutMs: 25,
      intervalMs: 1,
    }),
    AnalysisWaitTimeout,
  );
  assert.ok(progress.length > 0);
  assert.ok(progress.every((value) => value === 70));
});

test("checking again retrieves the existing completed analysis", async () => {
  const id = await pollAnalysis({
    getStatus: async () => ({
      ...pending,
      status: "COMPLETED",
      progressPercent: 100,
    }),
    onProgress: () => {},
  });
  assert.equal(id, 12);
});

test("server failure remains distinct from delayed analysis", async () => {
  await assert.rejects(
    pollAnalysis({
      getStatus: async () => ({
        ...pending,
        status: "FAILED",
        failureReason: "분석 서버 오류",
      }),
      onProgress: () => {},
    }),
    (error: unknown) =>
      error instanceof AnalysisFailed && error.message === "분석 서버 오류",
  );
});

test("default wait continues beyond two minutes and accepts completion", async (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  let calls = 0;
  const id = await pollAnalysis({
    getStatus: async () => {
      calls += 1;
      now = calls === 1 ? 121_000 : 599_999;
      return calls === 1 ? pending : { ...pending, status: "COMPLETED" };
    },
    onProgress: () => {},
    intervalMs: 0,
  });
  assert.equal(id, 12);
  assert.equal(calls, 2);
});

test("a received completion wins over the elapsed-time check", async (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const id = await pollAnalysis({
    getStatus: async () => {
      now = 600_001;
      return { ...pending, status: "COMPLETED" };
    },
    onProgress: () => {},
  });
  assert.equal(id, 12);
});

test("default wait stops after ten minutes if analysis is still processing", async (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  await assert.rejects(
    pollAnalysis({
      getStatus: async () => {
        now = 600_001;
        return pending;
      },
      onProgress: () => {},
    }),
    AnalysisWaitTimeout,
  );
});

test("connection recovery exhaustion before the overall deadline remains a connection error", async (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  await assert.rejects(
    pollAnalysis({
      getStatus: async () => {
        throw new ApiError("offline", 0, "NETWORK_ERROR");
      },
      onProgress: () => {},
      onConnectionChange: () => {
        now = 90_001;
      },
    }),
    AnalysisConnectionUnavailable,
  );
});
