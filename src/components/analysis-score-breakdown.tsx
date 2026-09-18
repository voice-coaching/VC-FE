"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import type { AnalysisCriterionScore, AnalysisScoreBreakdown } from "@/lib/api";

const formatPoints = (value: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);

function CriterionRow({ item }: { item: AnalysisCriterionScore }) {
  const descriptionId = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = pinned || hovered || focused;
  const scored = item.applicable && item.score != null;
  return (
    <li
      className="rounded-xl border border-border p-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          aria-expanded={expanded}
          aria-controls={descriptionId}
          aria-describedby={expanded ? descriptionId : undefined}
          onClick={() => setPinned(!pinned)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setPinned(false);
              setHovered(false);
              setFocused(false);
            }
          }}
        >
          {item.label}
          <Info
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">항목 설명</span>
        </button>
        <span className="shrink-0 text-sm font-semibold">
          {scored ? (
            <>
              {formatPoints(item.score!)} / {item.maxScore}점
            </>
          ) : item.applicable ? (
            "점수 미제공"
          ) : (
            "평가 대상 없음"
          )}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width:
              scored && item.maxScore > 0
                ? `${Math.max(0, Math.min(100, (item.score! / item.maxScore) * 100))}%`
                : "0%",
          }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {item.applicable
          ? `기대 음소 ${item.sampleCount}개 · 기본 배점 ${item.maxScore}점`
          : "이 문장에 해당 기대 음소가 없어 종합 점수에서 제외됩니다."}
      </p>
      <div
        id={descriptionId}
        hidden={!expanded}
        className="mt-3 rounded-lg bg-muted p-3 text-xs leading-5"
      >
        <p>{item.description}</p>
        <p className="mt-1 text-muted-foreground">
          기대 표지:{" "}
          {item.expectedPhones.length
            ? item.expectedPhones.join(" ")
            : "전체 기대 음소의 정렬 커버리지"}
        </p>
      </div>
    </li>
  );
}

export function AnalysisScoreBreakdownView({
  breakdown,
}: {
  breakdown?: AnalysisScoreBreakdown | null;
}) {
  return (
    <section className="design-card" aria-label="항목별 발음 점수">
      <h2 className="text-sm font-bold">항목별 발음 점수</h2>
      {!breakdown || breakdown.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          이 분석에는 항목별 점수 정보가 없습니다.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            항목을 누르거나 마우스를 올리면 설명을 볼 수 있어요. 점수는 각
            항목의 기본 배점 기준입니다.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {breakdown.items.map((item) => (
              <CriterionRow key={item.criterionId} item={item} />
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            평가 대상 배점 {breakdown.applicableMaxScore}점 중 획득 점수를 100점
            만점으로 환산해 종합 점수를 계산합니다. 문장에 없는 항목은 0점이
            아닌 평가 대상 없음으로 처리합니다. 분석 근거에 따른 연습용 점수이며
            발음 정확도의 확률은 아닙니다.
          </p>
        </>
      )}
    </section>
  );
}
