import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYSIS_MESSAGES,
  nextAnalysisMessageIndex,
} from "../src/lib/analysis-messages";

test("random analysis messages can reach every other message without repeating", () => {
  for (let current = 0; current < ANALYSIS_MESSAGES.length; current++) {
    const selected = new Set<number>();
    for (let slot = 0; slot < ANALYSIS_MESSAGES.length - 1; slot++) {
      const next = nextAnalysisMessageIndex(
        current,
        (slot + 0.5) / (ANALYSIS_MESSAGES.length - 1),
      );
      assert.notEqual(next, current);
      assert.ok(next >= 0 && next < ANALYSIS_MESSAGES.length);
      selected.add(next);
    }
    assert.equal(selected.size, ANALYSIS_MESSAGES.length - 1);
    assert.notEqual(nextAnalysisMessageIndex(current, 0), current);
    assert.notEqual(
      nextAnalysisMessageIndex(current, 1 - Number.EPSILON),
      current,
    );
  }
});
