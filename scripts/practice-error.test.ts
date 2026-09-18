import assert from "node:assert/strict";
import test from "node:test";
import {
  AnalysisFailed,
  AnalysisWaitTimeout,
} from "../src/lib/analysis-polling";
import { ApiError } from "../src/lib/api/client";
import {
  describePracticeError,
  PracticeInputError,
} from "../src/lib/practice-error";

test("recording words do not turn a wait timeout into a quality failure", () => {
  const error = new AnalysisWaitTimeout();
  assert.ok(error.message.includes("녹음"));
  assert.equal(describePracticeError(error).kind, "waiting");
  assert.equal(
    describePracticeError(new AnalysisFailed("녹음 분석 서버 오류")).kind,
    "analysis",
  );
  assert.equal(
    describePracticeError(new Error("녹음 처리 오류")).kind,
    "unknown",
  );
});
test("quality, preparation, unsupported, auth and network errors remain distinct", () => {
  for (const kind of [
    "quality",
    "preparation",
    "unsupported",
    "input",
  ] as const) {
    assert.equal(
      describePracticeError(new PracticeInputError(kind, "test")).kind,
      kind,
    );
  }
  assert.equal(
    describePracticeError(new ApiError("녹음 전송 실패", 0)).kind,
    "network",
  );
  assert.equal(
    describePracticeError(new ApiError("timeout", 408)).kind,
    "network",
  );
  assert.equal(
    describePracticeError(new ApiError("expired", 401)).kind,
    "auth",
  );
  assert.equal(
    describePracticeError(new ApiError("failed", 503)).kind,
    "server",
  );
  assert.equal(describePracticeError(null, "denied").kind, "recording");
});
