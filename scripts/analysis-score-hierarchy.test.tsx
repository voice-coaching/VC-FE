import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AnalysisScoreHierarchyView } from "../src/components/analysis-score-hierarchy";
import type { AnalysisScoreHierarchy } from "../src/lib/api/types";

const hierarchy: AnalysisScoreHierarchy = {
  rubricRevision: "clova-phone-rubric-v3",
  leafCount: 49,
  groups: [
    {
      id: "vowels",
      label: "모음",
      description: "모음 근거",
      maxScore: 25,
      score: 0,
      items: [
        {
          id: "vowels.a",
          label: "ㅏ 대응",
          description: "누락 후보 1개",
          status: "SCORED",
          sampleCount: 1,
          level: 0,
          normalizedScore: 0,
          attention: true,
          observation: null,
        },
        {
          id: "vowels.i",
          label: "ㅣ 대응",
          description: "없음",
          status: "NOT_APPLICABLE",
          sampleCount: 0,
          level: null,
          normalizedScore: null,
          attention: false,
          observation: null,
        },
      ],
    },
    {
      id: "lip_shape",
      label: "입술 형상",
      description: "관측",
      maxScore: null,
      score: null,
      items: [
        {
          id: "lip.inner_aperture",
          label: "안쪽 벌림",
          description: "점수가 아닌 관측값",
          status: "NOT_VALIDATED",
          sampleCount: null,
          level: null,
          normalizedScore: null,
          attention: false,
          observation: {
            value: 0.2,
            unit: "ratio",
            selectedExpectedIndex: 0,
            videoStartMs: 20,
            videoEndMs: 80,
          },
        },
      ],
    },
  ],
};
test("hierarchy distinguishes real zero, absent phonemes and unvalidated observations", () => {
  const html = renderToStaticMarkup(
    <AnalysisScoreHierarchyView hierarchy={hierarchy} />,
  );
  assert.match(html, /0 \/ 100점/);
  assert.match(html, /평가 대상 없음/);
  assert.match(html, /기준 검증 전 · 미채점/);
  assert.match(html, /관측 비율 0.2/);
  assert.match(html, /이번 분석에서 채점한 항목은 1개/);
  assert.match(html, /총점에 포함하지 않음/);
  assert.match(html, /title="누락 후보 1개"/);
  assert.match(html, /<details>/);
});
test("missing video and missing measurements have separate notices", () => {
  for (const [status, label] of [
    ["NOT_PROVIDED", "영상 미제공"],
    ["UNAVAILABLE", "관측 정보 부족"],
  ] as const) {
    const value = structuredClone(hierarchy);
    value.groups[1].items[0].status = status;
    value.groups[1].items[0].observation = null;
    const html = renderToStaticMarkup(
      <AnalysisScoreHierarchyView hierarchy={value} />,
    );
    assert.ok(html.includes(label));
    assert.ok(!html.includes("관측 비율"));
  }
});
