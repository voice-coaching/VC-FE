"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { DirectAnalysisResult } from "@/components/direct-analysis-result";
import {
  directAnalysisEnabled,
  listDirectHistory,
} from "@/lib/direct-analysis";

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

  if (!directAnalysisEnabled) return null;
  if (error)
    return (
      <div className="mt-4 rounded-2xl bg-white p-4">
        <p role="status" className="text-[13px] leading-5 text-[#8b95a1]">
          새 음성 분석 기록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      </div>
    );
  if (!items.length) return null;

  return (
    <section className="mt-5 space-y-2.5" aria-label="새 음성 분석 기록">
      <h2 className="px-1 text-[12px] leading-4 font-bold text-[#8b95a1]">
        새 음성 분석 기록
      </h2>
      {items.map((item) => (
        <details
          key={item.jobId}
          className="overflow-hidden rounded-2xl bg-white"
        >
          <summary className="flex min-h-[68px] cursor-pointer list-none items-center gap-3 py-3.5 pr-3.5 pl-4 marker:hidden">
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 rounded-full bg-[#edf2ff] px-[7px] py-0.5 text-[11px] leading-[14px] font-bold text-primary">
                  문장 연습
                </span>
                <strong className="truncate text-[15px] leading-[22px] font-bold text-[#191f28]">
                  {item.scriptText}
                </strong>
              </span>
              <span className="mt-[3px] block text-[12px] leading-4 text-[#8b95a1]">
                {item.result.score.overallScore == null
                  ? "점수 미제공"
                  : `${Math.round(item.result.score.overallScore)}점`}
                <span className="mx-1.5">·</span>
                {item.storageStatus === "SAVED" ? "저장 완료" : "저장 확인 중"}
              </span>
            </span>
            <Image
              src="/figma/catalog/chevron-right.svg"
              alt=""
              width={18}
              height={18}
              className="shrink-0 rotate-90"
            />
          </summary>
          <div className="space-y-4 border-t border-[#eef0f3] bg-[#f8f9fa] px-4 py-5">
            <DirectAnalysisResult
              result={item.result}
              content={{
                id: item.jobId,
                contentType: "SENTENCE",
                title: item.scriptText,
                scriptText: item.scriptText,
                referenceAudioAvailable: false,
              }}
            />
          </div>
        </details>
      ))}
    </section>
  );
}
