"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-width two-or-more tab strip with the app's shared switch motion: the
 * underline slides (360ms) and labels cross-fade colour (260ms), matching the
 * My page and history filter tabs. Pair the panel with `app-tab-panel` keyed by
 * the active tab so its content rises in the same way.
 */
export function SegmentTabs<T extends string>({
  tabs,
  active,
  onSelect,
  className,
}: {
  tabs: ReadonlyArray<readonly [T, string]>;
  active: T;
  onSelect: (value: T) => void;
  className?: string;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const element = strip.current;
    const button = element?.querySelector<HTMLElement>(
      `[data-tab="${active}"]`,
    );
    if (!element || !button) return;
    const measure = () =>
      setBar({ left: button.offsetLeft, width: button.offsetWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, tabs.length]);
  return (
    <div
      ref={strip}
      role="tablist"
      className={cn("relative flex border-b border-[#e5e8eb]", className)}
    >
      {tabs.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          data-tab={value}
          aria-selected={value === active}
          onClick={() => onSelect(value)}
          className={cn(
            "h-[52px] flex-1 text-[15px] leading-[22px] font-bold transition-colors duration-[260ms] motion-reduce:transition-none",
            value === active ? "text-[#191f28]" : "text-[#8b95a1]",
          )}
        >
          {label}
        </button>
      ))}
      {bar && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-px left-0 h-0.5 bg-[#191f28] transition-[transform,width] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${bar.left}px)`, width: bar.width }}
        />
      )}
    </div>
  );
}
