import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lipVisualSchema } from "./canonical-lip";
import { readCanonicalAnalysisView } from "./canonical-analysis";
import { canonicalPresentation } from "./canonical-presentation";
const fixture = () =>
  JSON.parse(
    readFileSync(
      new URL("../../scripts/fixtures/lip-analysis-view.json", import.meta.url),
      "utf8",
    ),
  );
type VisualFixture =
  (typeof import("../../scripts/fixtures/lip-analysis-view.json"))["canonicalAnalysis"]["visual"];
const expected = { analysisId: 88, recordingId: 55 };

test("null root lip score preserves overall score, provisional local practice and optional evidence", () => {
  const view = readCanonicalAnalysisView(fixture(), expected);
  const visual = lipVisualSchema.parse(view.canonicalAnalysis?.visual);
  assert.equal(canonicalPresentation(view).overallScore, 73.6);
  assert.equal(visual.score, null);
  assert.equal(visual.phoneAssessments[0].score, 0);
  assert.equal(visual.phoneAssessments[0].calibrationRevision, null);
  assert.deepEqual(visual.phoneAssessments[0].allowedActionIds, [
    "COMPARE_REFERENCE",
  ]);
  assert.equal(visual.subScores?.[0].score, null);
  assert.equal(visual.subScores?.[1].score, 0);
  assert.equal(
    visual.phoneAssessments[0].subScores?.[0].measurements?.[0].unit,
    "PHONE_PHASE",
  );
});

test("overall 0 and null are independent of an available root lip score", () => {
  for (const overall of [0, null]) {
    const value = fixture();
    value.canonicalAnalysis.score =
      overall === null
        ? {
            overallScore: null,
            validity: "NOT_CALIBRATED",
            reason: "NO_APPROVED_SCORING_CONTRACT",
          }
        : {
            overallScore: overall,
            validity: "RUBRIC_COMPUTED",
            reason: "EVIDENCE_BOUND_PRACTICE_SCORE",
          };
    Object.assign(value.canonicalAnalysis.visual, {
      status: "SCORED",
      score: 82.5,
      scoreKind: "PROVISIONAL",
    });
    const view = readCanonicalAnalysisView(value, expected);
    assert.equal(canonicalPresentation(view).overallScore, overall);
  }
});

test("historical responses may omit root and local subScores", () => {
  const visual = fixture().canonicalAnalysis.visual;
  delete visual.subScores;
  delete visual.phoneAssessments[0].subScores;
  Object.assign(visual.phoneAssessments[0], {
    status: "OBSERVED",
    score: null,
    scoreKind: "NONE",
    allowedActionIds: [],
  });
  visual.coverage.scoredCount = 0;
  const parsed = lipVisualSchema.parse(visual);
  assert.equal(parsed.subScores, undefined);
  assert.equal(parsed.phoneAssessments[0].subScores, undefined);
});

test("component scores enforce status/null, range and measurement units without calculating totals", () => {
  const mutations = [
    (v: VisualFixture) => (v.subScores[0].score = 0),
    (v: VisualFixture) => (v.subScores[1].score = null),
    (v: VisualFixture) => (v.subScores[1].score = 101),
    (v: VisualFixture) => v.subScores.push(...v.subScores, v.subScores[0]),
    (v: VisualFixture) =>
      (v.phoneAssessments[0].subScores[0].measurements[0].referenceScale = 0),
    (v: VisualFixture) =>
      (v.phoneAssessments[0].subScores[0].measurements[0].unit = "SECONDS"),
    (v: VisualFixture) =>
      (v.phoneAssessments[0].allowedActionIds = ["CORRECT_PRONUNCIATION"]),
    (v: VisualFixture) => (v.correctiveClaimsAllowed = true),
  ];
  for (const change of mutations) {
    const visual = fixture().canonicalAnalysis.visual;
    change(visual);
    assert.equal(lipVisualSchema.safeParse(visual).success, false);
  }
});

test("calibrated scores still need calibration; coverage and exact attempt identity stay enforced", () => {
  const value = fixture();
  value.canonicalAnalysis.visual.phoneAssessments[0].scoreKind = "CALIBRATED";
  assert.equal(
    lipVisualSchema.safeParse(value.canonicalAnalysis.visual).success,
    false,
  );
  assert.throws(() =>
    readCanonicalAnalysisView(fixture(), { ...expected, recordingId: 999 }),
  );
  assert.throws(() =>
    readCanonicalAnalysisView(fixture(), {
      ...expected,
      executionId: "00000000-0000-4000-8000-000000000009",
    }),
  );
  const visual = fixture().canonicalAnalysis.visual;
  visual.coverage.scoredCount = 2;
  assert.equal(lipVisualSchema.safeParse(visual).success, false);
});

test("a failed or rejected result cannot present an old numeric overall score", () => {
  const view = readCanonicalAnalysisView(fixture(), expected);
  assert.equal(
    canonicalPresentation({ ...view, jobStatus: "FAILED" }).overallScore,
    null,
  );
  view.canonicalAnalysis!.decision.status = "REJECT";
  assert.equal(canonicalPresentation(view).overallScore, null);
});
