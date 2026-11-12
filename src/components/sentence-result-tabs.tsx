"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  RotateCw,
} from "lucide-react";
import { scoreDetailRows, type PublicScoreDetails } from "@/lib/score-details";

export type SentenceResultTab = {
  key: string;
  text: string;
  state: "ready" | "pending" | "error";
  score?: number | null;
  /** Server-provided criterion scores, compared across sentences only. */
  details?: PublicScoreDetails;
};

function formatScore(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(
    value,
  );
}

/**
 * One sentence at a time: a sticky strip of sentence cards (opening words +
 * score) picks which result is shown, so the page length no longer grows with
 * the number of sentences and every result is named by its own words.
 */
export function SentenceResultTabs({
  tabs,
  active,
  onSelect,
  renderPanel,
}: {
  tabs: SentenceResultTab[];
  active: number;
  onSelect: (index: number) => void;
  /** Rendered for the sentence currently on screen (lags `active` during the hand-off). */
  renderPanel: (index: number) => ReactNode;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Last selection the scroll logic acted on; effects re-run in dev Strict Mode.
  const scrolledFor = useRef(active);
  // The panel hands off in two beats: the old result drifts out, then the new
  // one glides in from the side the user moved toward.
  const [shown, setShown] = useState(active);
  const [phase, setPhase] = useState<"idle" | "out" | "mount" | "in">("idle");
  const [direction, setDirection] = useState(1);
  const [holdHeight, setHoldHeight] = useState<number | null>(null);
  useEffect(() => {
    if (active === shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(active);
      return;
    }
    setDirection(active > shown ? 1 : -1);
    // Hold the current height so the page doesn't collapse mid-swap.
    setHoldHeight(panel.current?.offsetHeight ?? null);
    setPhase("out");
    const swap = window.setTimeout(() => {
      // Mount the next result invisibly first: its first render is the heavy
      // part, and starting the glide only after it has painted keeps every frame.
      setShown(active);
      setPhase("mount");
    }, 220);
    return () => window.clearTimeout(swap);
  }, [active, shown]);
  useEffect(() => {
    if (phase !== "mount") return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase("in"));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [phase]);
  useEffect(() => {
    if (phase !== "in") return;
    const settle = window.setTimeout(() => {
      setPhase("idle");
      setHoldHeight(null);
    }, 640);
    return () => window.clearTimeout(settle);
  }, [phase, shown]);
  // One sentence needs no picker or cross-sentence summary.
  const single = tabs.length < 2;

  useEffect(() => {
    if (scrolledFor.current === active) return;
    scrolledFor.current = active;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    // Bring the chosen card to the front of the strip, leaving a sliver of
    // the previous one so the way back stays visible and tappable, while the
    // next sentence peeks in after it. The strip clamps at its ends.
    const row = strip.current;
    const card = row?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (row && card) {
      const inset = parseFloat(getComputedStyle(row).paddingLeft) || 0;
      const peek = active > 0 ? 44 : 0;
      row.scrollTo({
        left:
          row.scrollLeft +
          card.getBoundingClientRect().left -
          row.getBoundingClientRect().left -
          inset -
          peek,
        behavior: smooth ? "smooth" : "instant",
      });
    }
    // If the reader was deep in the previous result, start the new one at its top.
    const barBottom = bar.current?.getBoundingClientRect().bottom ?? 0;
    const panelTop = panel.current?.getBoundingClientRect().top ?? 0;
    if (panel.current && panelTop < barBottom) {
      panel.current.style.scrollMarginTop = `${bar.current?.offsetHeight ?? 0}px`;
      panel.current.scrollIntoView({
        behavior: smooth ? "smooth" : "instant",
        block: "start",
      });
    }
  }, [active]);

  // Edge fades show there is more to swipe to; they follow the scroll position.
  function updateFades() {
    const el = strip.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.style.setProperty("--fade-left", el.scrollLeft > 4 ? "28px" : "0px");
    el.style.setProperty(
      "--fade-right",
      max - el.scrollLeft > 4 ? "40px" : "0px",
    );
  }

  // One gentle nudge on arrival: the strip slides a little and settles back,
  // the usual app cue that the row continues off-screen.
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    updateFades();
    if (
      el.scrollWidth - el.clientWidth < 8 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let frame = 0;
    let cancelled = false;
    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      el.style.scrollSnapType = "";
    };
    el.addEventListener("pointerdown", stop, { once: true });
    el.addEventListener("wheel", stop, { once: true, passive: true });
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const distance = 44;
      // Snap would pull every frame straight back to the first card.
      el.style.scrollSnapType = "none";
      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / 1100);
        // Out and back on one smooth sine arc.
        el.scrollLeft = Math.sin(Math.PI * t) ** 2 * distance;
        if (t < 1) frame = requestAnimationFrame(tick);
        else el.style.scrollSnapType = "";
      };
      frame = requestAnimationFrame(tick);
    }, 700);
    return () => {
      window.clearTimeout(timer);
      stop();
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("wheel", stop);
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (active + step + tabs.length) % tabs.length;
    onSelect(next);
    strip.current
      ?.querySelector<HTMLElement>(`[data-index="${next}"]`)
      ?.focus();
  }

  return (
    <div>
      {!single && (
        <>
          {/* Level 1: a quiet eyebrow, so the summary headline leads. */}
          <p className="px-5 pt-5 text-[13px] leading-[18px] font-semibold text-[#4e5968]">
            문장별 결과
          </p>
          {/* Level 2: what all sentences have in common. */}
          <SentenceInsights tabs={tabs} onSelect={onSelect} />
        </>
      )}
      {/* Level 3: the picker. Only it stays pinned; title and summary scroll away. */}
      <div
        ref={bar}
        hidden={single}
        className="sticky top-0 z-10 bg-[#f2f4f6]/95 pt-4 backdrop-blur-md"
      >
        <div className="flex items-center justify-between px-5">
          <p className="text-[13px] leading-[18px] font-semibold text-[#4e5968]">
            문장 선택
          </p>
          <p className="text-[13px] leading-[18px] text-[#8b95a1] tabular-nums">
            <b className="font-bold text-[#6346f6]">{active + 1}</b> /{" "}
            {tabs.length}
          </p>
        </div>
        <div
          ref={strip}
          role="tablist"
          aria-label="결과를 볼 문장"
          onKeyDown={onKeyDown}
          onScroll={updateFades}
          className="sentence-tab-strip mt-2 flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 pt-0.5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab, index) => {
            const selected = index === active;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`sentence-tab-${index}`}
                aria-controls="sentence-result-panel"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                data-index={index}
                data-active={selected}
                onClick={() => onSelect(index)}
                className="sentence-tab"
              >
                <span className="flex items-center gap-1.5">
                  <span className="sentence-tab-index">{index + 1}</span>
                  <span className="sentence-tab-score">
                    {tab.state === "ready" && tab.score != null
                      ? `${formatScore(tab.score)}점`
                      : tab.state === "error"
                        ? "확인 필요"
                        : tab.state === "pending"
                          ? "분석 중"
                          : "점수 없음"}
                  </span>
                </span>
                <span className="sentence-tab-text">{tab.text}</span>
              </button>
            );
          })}
        </div>
        {/* Persistent page dots: the swipe cue that doesn't depend on catching the nudge. */}
        {tabs.length <= 8 && (
          <div
            className="-mt-[9px] flex justify-center pb-[3px]"
            aria-hidden="true"
          >
            {tabs.map((tab, index) => (
              // Dots double as a jump control; the cards stay the accessible tabs.
              <button
                key={tab.key}
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(index)}
                className="flex h-6 items-center px-[3px]"
              >
                <span className="sentence-dot" data-active={index === active} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={panel}
        id="sentence-result-panel"
        role="tabpanel"
        aria-labelledby={`sentence-tab-${active}`}
        style={holdHeight ? { minHeight: holdHeight } : undefined}
      >
        {/* Pull up so the gap below the strip matches the report's 20px rhythm. */}
        <div
          key={shown}
          className={`sentence-tab-panel ${single ? "" : "-mt-5"}`}
          data-phase={phase}
          style={{ "--dir": direction } as React.CSSProperties}
        >
          {renderPanel(shown)}
        </div>
      </div>
    </div>
  );
}

/** Placeholder while this sentence's analysis is still running. */
export function SentenceResultPending() {
  return (
    <section
      role="status"
      className="mx-5 mt-5 mb-3 flex flex-col items-center rounded-[20px] bg-white px-5 pt-8 pb-7 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[#f3f0ff] text-[#6346f6]">
        <LoaderCircle
          size={24}
          strokeWidth={2.25}
          className="animate-[spin_1.6s_linear_infinite] motion-reduce:animate-none"
          aria-hidden="true"
        />
      </span>
      <h3 className="mt-3.5 text-[16px] leading-6 font-bold text-[#191f28]">
        이 문장을 분석하고 있어요
      </h3>
      <p className="mt-1 text-[13px] leading-5 text-[#8b95a1]">
        잠시 후 결과가 여기에 나타나요
      </p>
    </section>
  );
}

/** This sentence's analysis could not be read; offers a re-check. */
export function SentenceResultError({
  message,
  busy,
  onRetry,
  retryLabel = "다시 확인하기",
}: {
  message: string;
  busy?: boolean;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <section className="mx-5 mt-5 mb-3 flex flex-col items-center rounded-[20px] bg-white px-5 pt-8 pb-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[#fff1f2] text-[#f04452]">
        <CircleAlert size={24} strokeWidth={2.25} aria-hidden="true" />
      </span>
      <h3 className="mt-3.5 text-[16px] leading-6 font-bold text-[#191f28]">
        결과를 불러오지 못했어요
      </h3>
      <p role="alert" className="mt-1 text-[13px] leading-5 text-[#8b95a1]">
        {message}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onRetry}
        className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-full bg-[#f2f4f6] px-5 text-sm font-bold text-[#4e5968] disabled:opacity-50"
      >
        <RotateCw
          size={16}
          strokeWidth={2.25}
          className={
            busy
              ? "animate-[spin_1.6s_linear_infinite] motion-reduce:animate-none"
              : ""
          }
          aria-hidden="true"
        />
        {retryLabel}
      </button>
    </section>
  );
}

/** 이/가 by whether the last Hangul syllable has a final consonant. */
function subjectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? "이" : "가";
}

/**
 * A two-line digest across sentences: which criterion was weakest most often,
 * and which sentence scored best. Only compares server scores; nothing is
 * averaged or recomputed.
 */
function SentenceInsights({
  tabs,
  onSelect,
}: {
  tabs: SentenceResultTab[];
  onSelect: (index: number) => void;
}) {
  const scored = tabs.flatMap((tab, index) =>
    tab.state === "ready" && tab.details ? [{ tab, index }] : [],
  );
  if (scored.length < 2) return null;

  // Lead with what went well: count how often each criterion is a
  // sentence's highest. Weak points stay on each sentence's own report.
  const tally = new Map<string, { label: string; count: number }>();
  for (const { tab } of scored) {
    const strongest = scoreDetailRows(tab.details!).reduce<
      PublicScoreDetails["criteria"][number] | undefined
    >(
      (top, row) =>
        row.status === "SCORED" &&
        (!top || top.status !== "SCORED" || row.score > top.score)
          ? row
          : top,
      undefined,
    );
    if (!strongest || strongest.status !== "SCORED") continue;
    const entry = tally.get(strongest.criterionId) ?? {
      label: strongest.label,
      count: 0,
    };
    entry.count += 1;
    tally.set(strongest.criterionId, entry);
  }
  const common = [...tally.values()].sort((a, b) => b.count - a.count)[0];
  const showCommon = common && common.count >= 2;

  const best = tabs.reduce<{ index: number; score: number } | null>(
    (top, tab, index) =>
      tab.state === "ready" &&
      tab.score != null &&
      (!top || tab.score > top.score)
        ? { index, score: tab.score }
        : top,
    null,
  );

  if (!showCommon && !best) return null;
  return (
    // Not another card: an editorial headline with a highlighted keyword,
    // so the summary reads differently from the card stack below it.
    <section aria-label="문장별 결과 요약" className="px-5 pt-2">
      {showCommon ? (
        <p className="text-[21px] leading-[31px] font-bold tracking-[-0.01em] text-[#191f28]">
          <mark className="sentence-insight-mark">{common.label}</mark>
          {subjectParticle(common.label)}{" "}
          <span className="text-[#6346f6] tabular-nums">
            {common.count === scored.length
              ? `${scored.length}문장 모두`
              : `${scored.length}문장 중 ${common.count}문장`}
          </span>
          에서
          <br />
          가장 돋보였어요
        </p>
      ) : (
        best && (
          <p className="text-[21px] leading-[31px] font-bold tracking-[-0.01em] text-[#191f28]">
            <mark className="sentence-insight-mark">
              {best.index + 1}번 문장
            </mark>
            을 가장 잘 읽었어요
          </p>
        )
      )}
    </section>
  );
}
