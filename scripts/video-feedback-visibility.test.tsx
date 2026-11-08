import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
// Exercise the real component while replacing only Next's image renderer in Node SSR.
const componentSource = readFileSync(
  "src/components/canonical-lip-result.tsx",
  "utf8",
).replace(/^import.*;$/gm, "");
const CanonicalLipResult = new Function(
  "React",
  "Image",
  ts.transpile(componentSource.replaceAll("export function", "function"), {
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
  }) + "\nreturn CanonicalLipResult;",
)(React, (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
  React.createElement("img", props),
);
import { visibleAnalysisScoreGroups } from "../src/lib/analysis-feedback";
import type { CanonicalAnalysisView } from "../src/lib/canonical-analysis";
import type { AnalysisScoreGroup } from "../src/lib/api";

const audiovisualView = {
  jobStatus: "COMPLETED",
  canonicalAnalysis: {
    decision: { status: "ACCEPT" },
    feedbackDeliveryAllowed: true,
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

test("camera feedback preserves null root score, provisional 0 and local component evidence", () => {
  const value = JSON.parse(
    readFileSync("scripts/fixtures/lip-analysis-view.json", "utf8"),
  );
  const html = renderToStaticMarkup(
    <CanonicalLipResult view={value} isCameraPractice />,
  );
  assert.match(html, /점수 미제공/);
  assert.match(html, /임시 참조 적합성 0점/);
  assert.match(html, /평가 정보 부족/);
  assert.match(html, /입술 둥글림/);
  assert.match(html, /입술 움직임 시점/);
  assert.match(html, /참조 비교 연습/);
  assert.match(html, /입술 움직임 관찰/);
  assert.doesNotMatch(html, /신뢰할 수 있는 입술 관찰 없음/);
  assert.doesNotMatch(html, /점수는 음성 종합 점수에 합산하지/);
});

test("failed, pending and rejected jobs do not render visual scores", () => {
  for (const status of ["FAILED", "PENDING", "PROCESSING"]) {
    const value = JSON.parse(
      readFileSync("scripts/fixtures/lip-analysis-view.json", "utf8"),
    );
    value.jobStatus = status;
    assert.equal(
      renderToStaticMarkup(
        <CanonicalLipResult view={value} isCameraPractice />,
      ),
      "",
    );
  }
  const value = JSON.parse(
    readFileSync("scripts/fixtures/lip-analysis-view.json", "utf8"),
  );
  value.canonicalAnalysis.decision.status = "REJECT";
  assert.equal(
    renderToStaticMarkup(<CanonicalLipResult view={value} isCameraPractice />),
    "",
  );
});
