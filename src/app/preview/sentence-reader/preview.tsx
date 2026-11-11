"use client";

import { useState } from "react";
import { NewsRecordingReader } from "@/components/news-recording";

const SENTENCES = [
  "정책 변화가 지역 산업과 생활 방식에 미치는 영향을 분석했습니다.",
  "자료를 비교한 결과 예상보다 큰 차이가 나타났지만 해결책을 찾았습니다.",
  "새로운 기준을 적용해 전체 결과를 다시 검토했습니다.",
  "청중이 이해할 수 있도록 핵심 내용을 단계별로 설명하겠습니다.",
  "지금까지 확인한 내용을 바탕으로 다음 실행 계획을 정리하겠습니다.",
];

/** Dev-only: the multi-sentence reader, to check the sentence hand-off. */
export function SentenceReaderPreview() {
  const [active, setActive] = useState(-1);
  const recording = active >= 0;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col bg-[#f2f4f6] pt-4">
      <NewsRecordingReader
        label="문장 연습"
        sentences={SENTENCES}
        active={Math.max(0, active)}
        recording={recording}
      />
      <div className="mt-6 flex justify-center gap-2 px-5">
        <button
          type="button"
          onClick={() => setActive(-1)}
          className="h-11 rounded-full bg-white px-4 text-sm font-bold text-[#4e5968]"
        >
          처음으로
        </button>
        <button
          type="button"
          onClick={() =>
            setActive((value) => Math.min(SENTENCES.length - 1, value + 1))
          }
          className="h-11 rounded-full bg-[#6346f6] px-5 text-sm font-bold text-white"
        >
          {recording ? "다음 문장" : "녹음 시작"}
        </button>
      </div>
    </main>
  );
}
