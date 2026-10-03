"use client";

import { useEffect, useRef } from "react";

export function SentenceReader({
  sentences,
  activeIndex,
  className = "",
}: {
  sentences: string[];
  activeIndex?: number;
  className?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Only this reading pane moves; recording controls stay in place.
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [activeIndex]);
  const start = activeIndex ?? 0;
  return (
    <div
      ref={viewport}
      role="region"
      aria-label="연습 문장"
      tabIndex={0}
      className={`min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-2xl bg-white p-2 ${className}`}
    >
      <ol start={start + 1} className="space-y-1">
        {sentences.slice(start).map((sentence, offset) => {
          const index = start + offset;
          const active = index === activeIndex;
          return (
            <li
              key={`${index}-${sentence}`}
              aria-current={active ? "step" : undefined}
              className={`flex items-start gap-3 rounded-xl px-3 py-3 ${active ? "bg-[#edf2ff]" : ""}`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#edf2ff] text-xs font-bold text-[#2f6bff]">
                {index + 1}
              </span>
              <p
                className={`min-w-0 flex-1 whitespace-pre-wrap text-base leading-6 [overflow-wrap:anywhere] ${active ? "font-bold text-[#191f28]" : activeIndex === undefined ? "font-medium text-[#191f28]" : "text-[#8b95a1]"}`}
              >
                {sentence}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
