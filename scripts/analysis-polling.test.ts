import assert from "node:assert/strict";
import test from "node:test";
import {
  AnalysisFailed,
  AnalysisWaitTimeout,
  pollAnalysis,
} from "../src/lib/analysis-polling";
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

test("default wait continues beyond two minutes and accepts completion", async () => {
  const originalNow = Date.now;
  let now = 0;
  let calls = 0;
  Date.now = () => now;
  try {
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
  } finally {
    Date.now = originalNow;
  }
});

test("a received completion wins over the elapsed-time check", async () => {
  const originalNow = Date.now;
  let now = 0;
  Date.now = () => now;
  try {
    const id = await pollAnalysis({
      getStatus: async () => {
        now = 600_001;
        return { ...pending, status: "COMPLETED" };
      },
      onProgress: () => {},
    });
    assert.equal(id, 12);
  } finally {
    Date.now = originalNow;
  }
});

test("default wait stops after ten minutes if analysis is still processing", async () => {
  const originalNow = Date.now;
  let now = 0;
  Date.now = () => now;
  try {
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
  } finally {
    Date.now = originalNow;
  }
});
