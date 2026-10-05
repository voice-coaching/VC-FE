"use client";
import { useEffect, useState } from "react";
import {
  directAnalysisEnabled,
  listDirectHistory,
} from "@/lib/direct-analysis";
import { DirectAnalysisResult } from "./direct-analysis-result";

export function DirectHistory() {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof listDirectHistory>>
  >([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!directAnalysisEnabled) return;
    const controller = new AbortController();
    void listDirectHistory(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setItems(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  if (error)
    return (
      <p role="status" className="p-5">
        음성 분석 이력을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.
      </p>
    );
  if (!items.length) return null;
  return (
    <section className="space-y-3 p-5">
      <h2 className="font-bold">음성 분석 기록</h2>
      {items.map((item) => (
        <details key={item.jobId}>
          <summary>
            {item.scriptText.slice(0, 60)} ·{" "}
            {item.result.score.overallScore ?? "점수 없음"}
          </summary>
          <DirectAnalysisResult result={item.result} />
          <p>{item.storageStatus === "SAVED" ? "저장 완료" : "근거 보관 중"}</p>
        </details>
      ))}
    </section>
  );
}
