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
