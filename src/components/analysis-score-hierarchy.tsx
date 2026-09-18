"use client";

import React from "react";
import type { AnalysisScoreHierarchy, AnalysisScoreLeaf } from "@/lib/api";

const points = (n: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(n);
const unavailable: Record<string, string> = {
  NOT_APPLICABLE: "평가 대상 없음",
  NOT_PROVIDED: "영상 미제공",
  UNAVAILABLE: "관측 정보 부족",
  NOT_VALIDATED: "기준 검증 전 · 미채점",
  LEGACY_UNAVAILABLE: "세부 정보 없음",
};
function Leaf({ item }: { item: AnalysisScoreLeaf }) {
  const scored = item.status === "SCORED" && item.normalizedScore != null;
  return (
    <li className="rounded-lg border border-border p-3">
      <details>
        <summary
          title={item.description}
          className="cursor-pointer rounded text-sm focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="font-medium">{item.label}</span>
          <span className="ml-2">
            {scored
              ? `${points(item.normalizedScore!)} / 100점`
              : (unavailable[item.status] ?? "점수 미제공")}
          </span>
          {item.attention && (
            <span className="ml-2 text-xs text-primary">우선 확인</span>
          )}
        </summary>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {item.description}
        </p>
        {item.sampleCount != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            기대 음소 표본 {item.sampleCount}개
            {item.sampleCount === 1
              ? " · 한 번의 관측으로 확정하지 않아요."
              : ""}
          </p>
        )}
        {item.observation != null && (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            선택 구간의 관측 비율 {points(item.observation.value)} ·{" "}
            {(item.observation.videoStartMs / 1000).toFixed(2)}~
            {(item.observation.videoEndMs / 1000).toFixed(2)}초. 관측값은 점수가
            아니며 문장 전체의 입술 움직임을 대표하지 않습니다.
          </p>
        )}
        {item.status === "UNAVAILABLE" && (
          <p className="mt-1 text-xs text-muted-foreground">
            추가 계측 또는 유효한 영상 근거가 필요합니다. 발음 불량 판정이
            아닙니다.
          </p>
        )}
      </details>
    </li>
  );
}
export function AnalysisScoreHierarchyView({
  hierarchy,
}: {
  hierarchy: AnalysisScoreHierarchy;
}) {
  const items = hierarchy.groups.flatMap((g) => g.items);
  const scoredCount = items.filter(
    (i) => i.status === "SCORED" && i.normalizedScore != null,
  ).length;
  return (
    <section className="design-card" aria-label="음소별 상세 평가">
      <h2 className="text-sm font-bold">음소별 상세 평가</h2>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        전체 {hierarchy.leafCount}개 중 이번 분석에서 채점한 항목은{" "}
        {scoredCount}개예요. 대분류를 펼친 뒤 항목을 누르거나 마우스를 올리면
        근거를 볼 수 있어요. 소분류는 각각 100점 기준이며 서로 더해 총점을
        계산하지 않습니다.
      </p>
      <div className="mt-4 space-y-3">
        {hierarchy.groups.map((group) => (
          <details
            key={group.id}
            className="rounded-xl border border-border p-3"
          >
            <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">
              {group.label} · {group.items.length}항목
              <span className="ml-2">
                {group.score != null && group.maxScore != null
                  ? `${points(group.score)} / ${group.maxScore}점`
                  : group.maxScore == null
                    ? "총점에 포함하지 않음"
                    : "평가 대상 없음"}
              </span>
            </summary>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {group.description}
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => (
                <Leaf key={item.id} item={item} />
              ))}
            </ul>
          </details>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        문장에 없는 음소는 0점이 아닙니다. 입술 항목은 기준이 검증될 때까지
        채점하지 않습니다. 분석 근거에 따른 연습용 평가이며 발음 정확도 확률은
        아닙니다.
      </p>
    </section>
  );
}
