"use client";

import { useEffect, useRef } from "react";

export function SentenceReader({
  sentences,
  activeIndex,
  pageIndex,
  className = "",
  variant = "reader",
}: {
  sentences: string[];
  activeIndex?: number;
  pageIndex?: number;
  className?: string;
  variant?: "reader" | "cards" | "recording";
}) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Only this reading pane moves; recording controls stay in place.
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [activeIndex, pageIndex]);
  const start = pageIndex ?? activeIndex ?? 0;
  return (
    <div
      ref={viewport}
      role="region"
      aria-label={
        pageIndex === undefined
          ? "연습 문장"
          : `연습 문장 ${start + 1} / ${sentences.length}`
      }
      data-sentence-page={pageIndex === undefined ? undefined : start + 1}
      tabIndex={0}
      className={`min-h-0 min-w-0 overflow-y-auto overscroll-contain outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#8b95a1] ${variant === "cards" ? "" : "rounded-2xl bg-white p-2"} ${className}`}
    >
      <ol
        start={start + 1}
        className={
          variant === "cards"
            ? "space-y-2 pb-1"
            : variant === "recording"
              ? "space-y-1"
              : "space-y-1"
        }
      >
        {sentences
          .slice(start, pageIndex === undefined ? undefined : start + 1)
          .map((sentence, offset) => {
            const index = start + offset;
            const active = index === activeIndex;
            return (
              <li
                key={`${index}-${sentence}`}
                aria-current={active ? "step" : undefined}
                className={`flex items-start gap-3 transition-colors duration-300 motion-reduce:transition-none ${variant === "cards" ? "rounded-[12px] bg-white px-4 py-3.5" : `rounded-xl px-3 py-3 ${active ? "bg-gradient-to-r from-[#eee9ff] to-[#edf2ff]" : ""}`}`}
              >
                <span
                  aria-hidden="true"
                  className={`relative flex shrink-0 items-center justify-center ${variant === "recording" ? "w-[3px] self-stretch" : "size-6"}`}
                >
                  <span
                    className={`absolute inset-0 flex items-center justify-center rounded-full bg-[#f1edff] text-xs font-bold text-[#6346f6] transition-opacity duration-300 motion-reduce:transition-none ${variant === "recording" ? "opacity-0" : "opacity-100"}`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`absolute inset-y-0 left-0 w-[3px] rounded-full bg-gradient-to-b from-[#7347f2] to-[#5b7bfa] transition-opacity duration-300 motion-reduce:transition-none ${variant === "recording" && active ? "opacity-100" : "opacity-0"}`}
                  />
                </span>
                <p
                  className={`min-w-0 flex-1 whitespace-pre-wrap transition-colors duration-300 motion-reduce:transition-none ${variant === "cards" ? "text-[15px] leading-[22px]" : "text-base leading-6"} [overflow-wrap:anywhere] ${active ? "font-bold text-[#191f28]" : activeIndex === undefined ? `${variant === "cards" ? "font-medium" : "font-bold"} text-[#191f28]` : "font-bold text-[#b0b8c1]"}`}
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
