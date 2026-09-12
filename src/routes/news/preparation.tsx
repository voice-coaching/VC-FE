"use client";

import { useCallback, useMemo, useState } from "react";
import { NewsPlayer } from "./player";

export function NewsPreparation({
  sentences,
  today = false,
  adapted = false,
}: {
  sentences: string[];
  today?: boolean;
  adapted?: boolean;
}) {
  const [active, setActive] = useState(-1);
  const [seekRequest, setSeekRequest] = useState<{
    position: number;
    id: number;
  }>();
  // Prototype-only cues: distribute the 38-second sample by sentence length.
  // Replace with audio-aligned timestamps when real example audio is connected.
  const starts = useMemo(() => {
    const lengths = sentences.map(
      (sentence) => sentence.replace(/\s/g, "").length,
    );
    const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
    let offset = 0;
    return lengths.map((length) => {
      const start = (offset / total) * 38;
      offset += length;
      return start;
    });
  }, [sentences]);
  const updateSentence = useCallback(
    (position: number) => {
      let next = 0;
      starts.forEach((start, index) => {
        if (position >= start) next = index;
      });
      setActive(next);
    },
    [starts],
  );

  return (
    <div className="space-y-4 pt-3">
      <h2 className="text-lg font-bold">이 문장들을 읽어볼게요</h2>
      <p className="text-sm leading-6 text-[#4e5968]">
        {today
          ? `오늘의 뉴스에서 핵심 ${sentences.length}문장만 연습해요.`
          : adapted
            ? `기사의 핵심 내용을 ${sentences.length}문장으로 정리했어요.`
            : `기사를 ${sentences.length}문장으로 나눴어요.`}
        {(today || adapted) && " 소리 내어 읽기 좋도록 일부 표현을 다듬었어요."}
      </p>
      <NewsPlayer onPositionChange={updateSentence} seekRequest={seekRequest} />
      <h2 className="flex justify-between pt-2 text-sm font-bold">
        연습 문장
        <span className="text-xs font-normal text-[#8b95a1]">
          {sentences.length}문장
        </span>
      </h2>
      <ol className="space-y-1 rounded-[18px] bg-white p-2.5 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
        {sentences.map((sentence, index) => (
          <li key={sentence}>
            <button
              type="button"
              aria-current={active === index ? "step" : undefined}
              aria-label={`${index + 1}번 문장으로 이동: ${sentence}`}
              onClick={() => {
                setActive(index);
                setSeekRequest((previous) => ({
                  position: starts[index],
                  id: (previous?.id ?? 0) + 1,
                }));
              }}
              className={`flex min-h-11 w-full gap-2 rounded-xl px-2 py-2 text-left text-sm leading-5 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-[#2f6bff] motion-reduce:transition-none ${active === index ? "bg-[#edf2ff] text-[#191f28]" : "bg-transparent"}`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] transition-colors duration-300 motion-reduce:transition-none ${active === index ? "bg-[#e0e9ff] text-[#2f6bff]" : "bg-[#f2f4f6] text-[#8b95a1]"}`}
              >
                {index + 1}
              </span>
              <span>{sentence}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
