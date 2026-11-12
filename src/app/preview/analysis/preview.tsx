"use client";

import { useEffect, useState } from "react";
import { PracticeAnalysisLoading } from "@/components/practice-analysis-loading";
import { SentenceResultsPreview } from "../sentence-results/preview";

type Mode = "auto" | "uploading" | "recovering" | "report" | 0 | 33 | 66 | 100;

const MODES: { mode: Mode; label: string }[] = [
  { mode: "auto", label: "자동 진행" },
  { mode: "report", label: "완료→리포트" },
  { mode: "uploading", label: "업로드" },
  { mode: 0, label: "1단계" },
  { mode: 33, label: "2단계" },
  { mode: 66, label: "3단계" },
  { mode: 100, label: "완료" },
  { mode: "recovering", label: "연결 복구" },
];

/** Dev-only: the shared analysis waiting screen without recording anything. */
export function AnalysisLoadingPreview() {
  const [mode, setMode] = useState<Mode>("auto");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (mode !== "auto") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1800);
    return () => window.clearInterval(timer);
  }, [mode]);
  // "완료→리포트": the finished state holds 1.5s, as in the live flow, then
  // the report slides in.
  const [showReport, setShowReport] = useState(false);
  useEffect(() => {
    setShowReport(false);
    if (mode !== "report") return;
    const timer = window.setTimeout(() => setShowReport(true), 1500);
    return () => window.clearTimeout(timer);
  }, [mode, tick]);
  // Auto: upload → step 1 → 2 → 3 → done, then loop.
  const phase = tick % 5;
  const uploading = mode === "uploading" || (mode === "auto" && phase === 0);
  const progress =
    mode === "auto"
      ? [0, 0, 33, 66, 100][phase]
      : mode === "report"
        ? 100
        : typeof mode === "number"
          ? mode
          : 0;
  if (showReport)
    return (
      <>
        <div className="report-reveal">
          <SentenceResultsPreview />
        </div>
        <button
          type="button"
          onClick={() => setTick((value) => value + 1)}
          className="fixed bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-[6px] bg-[#191f28] px-3 py-1.5 text-xs font-medium text-white shadow-sm"
        >
          다시 보기
        </button>
      </>
    );
  return (
    <main className="mx-auto flex h-dvh max-w-[402px] flex-col bg-[#f2f4f6]">
      <header className="flex h-12 shrink-0 items-center justify-center text-[17px] font-bold">
        분석 중
      </header>
      <PracticeAnalysisLoading
        uploading={uploading}
        connectionRecovering={mode === "recovering"}
        stepProgress={progress}
      />
      <div className="fixed inset-x-0 bottom-3 z-10 mx-auto flex max-w-[402px] flex-wrap justify-center gap-1.5 px-3">
        {MODES.map((item) => (
          <button
            key={String(item.mode)}
            type="button"
            onClick={() => {
              setMode(item.mode);
              setTick(0);
            }}
            className={`rounded-[6px] px-2.5 py-1.5 text-xs font-medium shadow-sm ${
              mode === item.mode
                ? "bg-[#191f28] text-white"
                : "bg-white/90 text-[#4e5968]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </main>
  );
}
