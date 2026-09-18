import assert from "node:assert/strict";
import test from "node:test";
import {
  coachingSeekTime,
  supportedCoaching,
  visualMeasurementLabel,
  type AnalysisCoaching,
  type CoachingItem,
} from "../src/lib/coaching";

test("legacy and unknown versions retain the legacy renderer", () => {
  assert.equal(supportedCoaching(undefined), null);
  assert.equal(supportedCoaching(null), null);
  assert.equal(
    supportedCoaching({ schemaVersion: "future" } as AnalysisCoaching),
    null,
  );
  assert.equal(
    supportedCoaching({
      schemaVersion: "voice-coaching.coaching-result.v1",
    } as AnalysisCoaching),
    null,
  );
});

test("supported evidence-only results retain null score rather than zero", () => {
  const coaching = {
    schemaVersion: "voice-coaching.coaching-result.v1",
    status: "LIMITED_EVIDENCE",
    items: [],
    limitations: [],
    strengths: [],
    visual: { observations: [] },
    score: { overallScore: null, validity: "INSUFFICIENT_EVIDENCE" },
    generation: { source: "TEMPLATE" },
  } as unknown as AnalysisCoaching;
  assert.equal(supportedCoaching(coaching), coaching);
  assert.equal(supportedCoaching(coaching)?.score.overallScore, null);
});

test("seek uses valid observed spans and rejects unavailable or invalid times", () => {
  const item = {
    location: {
      startMs: 1250,
      endMs: 1400,
      timingProvenance: "CTC_NONBLANK_SPAN",
    },
  } as CoachingItem;
  assert.equal(coachingSeekTime(item), 1.25);
  for (const patch of [
    { startMs: null },
    { endMs: null },
    { startMs: -1 },
    { endMs: 1000 },
    { startMs: Number.NaN },
    { endMs: Number.POSITIVE_INFINITY },
    { timingProvenance: "UNAVAILABLE" as const },
  ]) {
    assert.equal(
      coachingSeekTime({ ...item, location: { ...item.location, ...patch } }),
      null,
    );
  }
});

test("visual details use readable labels without echoing internal identifiers", () => {
  assert.equal(
    visualMeasurementLabel("inner_aperture_ratio"),
    "안쪽 입술 벌림 비율",
  );
  assert.equal(visualMeasurementLabel("unknown_future_cue"), "추가 입술 관측");
});
