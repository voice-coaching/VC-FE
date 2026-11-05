import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanonicalLipResult } from "../src/components/canonical-lip-result";
import { visibleAnalysisScoreGroups } from "../src/lib/analysis-feedback";
import type { CanonicalAnalysisView } from "../src/lib/canonical-analysis";
import type { AnalysisScoreGroup } from "../src/lib/api";

const audiovisualView = {
  canonicalAnalysis: {
    visual: {
      status: "NOT_PROVIDED",
      correctiveClaimsAllowed: false,
      score: null,
      scoreKind: "NONE",
      coverage: {
        targetCount: 0,
        visuallyEligibleCount: 0,
        observedCount: 0,
        scoredCount: 0,
        coverage: null,
      },
      phoneAssessments: [],
      omittedPhoneAssessmentCount: 0,
      reasonCodes: [],
      alignmentScope: "CANONICAL_MFA_DETECTOR_PHONES_V1",
      unresolvedExpectedIndices: [],
    },
  },
} as unknown as CanonicalAnalysisView;

test("video feedback text is hidden outside camera practice", () => {
  const html = renderToStaticMarkup(
    <CanonicalLipResult view={audiovisualView} isCameraPractice={false} />,
  );

  assert.equal(html, "");
});

test("camera practice may render the video feedback supplied by the server", () => {
  const html = renderToStaticMarkup(
    <CanonicalLipResult view={audiovisualView} isCameraPractice />,
  );

  assert.match(html, /입술 움직임 분석/);
  assert.match(html, /분석할 영상이 없어요/);
});

test("non-scoring video hierarchy groups are hidden outside camera practice", () => {
  const audioGroup = {
    id: "vowels",
    label: "모음",
    description: "모음 점수",
    maxScore: 25,
    score: 20,
    items: [],
  } satisfies AnalysisScoreGroup;
  const videoGroup = {
    id: "lip_shape",
    label: "입술 형상",
    description: "입술 관측",
    maxScore: null,
    score: null,
    items: [],
  } satisfies AnalysisScoreGroup;

  assert.deepEqual(
    visibleAnalysisScoreGroups([audioGroup, videoGroup], false),
    [audioGroup],
  );
  assert.deepEqual(visibleAnalysisScoreGroups([audioGroup, videoGroup], true), [
    audioGroup,
    videoGroup,
  ]);
});
