import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalysisScoreBreakdownView } from "../src/components/analysis-score-breakdown";
import type { AnalysisScoreBreakdown } from "../src/lib/api/types";

const breakdown: AnalysisScoreBreakdown = {
  rubricRevision: "clova-phone-rubric-v2",
  applicableMaxScore: 35,
  items: [
    {
      criterionId: "vowels",
      label: "모음",
      description: "모음 설명",
      expectedPhones: ["ㅏ"],
      maxScore: 25,
      applicable: true,
      sampleCount: 4,
      level: 3,
      score: 18.75,
    },
    {
      criterionId: "plain_stops",
      label: "평음 파열음",
      description: "공기의 흐름을 막았다가 터뜨리면서 내는 예사소리(평음)",
      expectedPhones: ["ㄱ", "ㄷ", "ㅂ"],
      maxScore: 10,
      applicable: false,
      sampleCount: 0,
      level: null,
      score: null,
    },
    {
      criterionId: "coverage",
      label: "기대 음소 대응 범위",
      description: "대응 범위 설명",
      expectedPhones: [],
      maxScore: 10,
      applicable: true,
      sampleCount: 4,
      level: 4,
      score: 10,
    },
  ],
};

test("renders weighted points without rounding away quarter points or inventing absent scores", () => {
  const html = renderToStaticMarkup(
    <AnalysisScoreBreakdownView breakdown={breakdown} />,
  );
  assert.match(html, /18.75/);
  assert.match(html, /평가 대상 없음/);
  assert.match(html, /평가 대상 배점 35점/);
  assert.match(html, /공기의 흐름을 막았다가/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls=/);
  assert.match(html, /hidden=""/);
});
test("missing or legacy evidence is unavailable, not a zero", () => {
  for (const value of [undefined, null, { ...breakdown, items: [] }]) {
    const html = renderToStaticMarkup(
      <AnalysisScoreBreakdownView breakdown={value} />,
    );
    assert.match(html, /항목별 점수 정보가 없습니다/);
    assert.doesNotMatch(html, /평가 대상 없음|0점/);
  }
});
test("an applicable zero is displayed as a score", () => {
  const value = {
    ...breakdown,
    items: [{ ...breakdown.items[0], level: 0, score: 0 }],
  };
  const html = renderToStaticMarkup(
    <AnalysisScoreBreakdownView breakdown={value} />,
  );
  assert.match(html, /0 \/ 25점/);
  assert.doesNotMatch(html.match(/<li[\s\S]*?<\/li>/)![0], /평가 대상 없음/);
});
