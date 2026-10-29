"use client";

import { useEffect, useRef } from "react";

export function SentenceReader({
  sentences,
  activeIndex,
  className = "",
  variant = "reader",
}: {
  sentences: string[];
  activeIndex?: number;
  className?: string;
  variant?: "reader" | "cards" | "recording";
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
      className={`min-h-0 min-w-0 overflow-y-auto overscroll-contain outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#8b95a1] ${variant === "cards" ? "" : "rounded-2xl bg-white p-2"} ${className}`}
    >
      <ol
        start={start + 1}
        className={
          variant === "cards"
            ? "space-y-2.5 pb-1"
            : variant === "recording"
              ? "space-y-1"
              : "space-y-1"
        }
      >
        {sentences.slice(start).map((sentence, offset) => {
          const index = start + offset;
          const active = index === activeIndex;
          return (
            <li
              key={`${index}-${sentence}`}
              aria-current={active ? "step" : undefined}
              className={`flex items-start gap-3 transition-colors duration-300 motion-reduce:transition-none ${variant === "cards" ? "rounded-[12px] bg-white p-3.5 shadow-[0_2px_6px_rgba(23,23,23,0.05)]" : `rounded-xl px-3 py-3 ${active ? "bg-[#e5eeff]" : ""}`}`}
            >
              <span
                aria-hidden="true"
                className="relative flex size-6 shrink-0 items-center justify-center"
              >
                <span
                  className={`absolute inset-0 flex items-center justify-center rounded-full bg-[#edf2ff] text-xs font-bold text-[#2f6bff] transition-opacity duration-300 motion-reduce:transition-none ${variant === "recording" ? "opacity-0" : "opacity-100"}`}
                >
                  {index + 1}
                </span>
                <span
                  className={`absolute inset-y-0 left-0 w-[3px] rounded-full bg-[#2f6bff] transition-opacity duration-300 motion-reduce:transition-none ${variant === "recording" && active ? "opacity-100" : "opacity-0"}`}
                />
              </span>
              <p
                className={`min-w-0 flex-1 whitespace-pre-wrap transition-colors duration-300 motion-reduce:transition-none ${variant === "cards" ? "text-[15px] leading-[22px]" : "text-base leading-6"} [overflow-wrap:anywhere] ${active ? "font-bold text-[#191f28]" : activeIndex === undefined ? "font-bold text-[#191f28]" : "font-bold text-[#b0b8c1]"}`}
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
