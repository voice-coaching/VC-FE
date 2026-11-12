"use client";

import { useEffect, useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import {
  formatPublicScore,
  scoreDetailRows,
  unscorableScoreReason,
  type PublicScoreDetails,
} from "@/lib/score-details";

type Criterion = PublicScoreDetails["criteria"][number];

/** What each axis measures, so a tapped score explains itself. */
const CRITERION_HINTS: Record<Criterion["criterionId"], string> = {
  pronunciation_accuracy:
    "음절 하나하나를 표준 발음에 가깝게 소리 냈는지 봐요.",
  speaking_rate: "쉼을 포함한 전체 말하기 속도가 알맞은지 봐요.",
  articulation_rate: "쉼을 뺀, 실제로 소리 내는 구간의 속도를 봐요.",
  pauses: "끊어 읽는 위치와 길이가 자연스러운지 봐요.",
  pitch: "문장 흐름에 맞게 목소리 높낮이가 변하는지 봐요.",
  intensity: "목소리 크기가 안정적이고 또렷하게 유지되는지 봐요.",
};

// Geometry in a 320×280 box; HTML labels use the same numbers as percentages.
const W = 320;
const H = 288;
const CX = 160;
const CY = 146;
const R = 80;
const RINGS = [0.25, 0.5, 0.75, 1];

function point(index: number, ratio: number) {
  const angle = (-90 + index * 60) * (Math.PI / 180);
  return {
    x: CX + Math.cos(angle) * R * ratio,
    y: CY + Math.sin(angle) * R * ratio,
  };
}

function polygon(ratios: number[]) {
  return ratios
    .map((ratio, index) => {
      const { x, y } = point(index, ratio);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Where a ray from the centre at fractional axis `a` meets the closed shape
 * through `ratios`. At whole numbers this is the vertex itself; in between it
 * slides along the edge, so motion follows the drawn outline.
 */
function rayHit(a: number, ratios: number[]) {
  const k = ((Math.floor(a) % 6) + 6) % 6;
  const p = point(k, ratios[k]);
  const q = point((k + 1) % 6, ratios[(k + 1) % 6]);
  const angle = (-90 + a * 60) * (Math.PI / 180);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ex = q.x - p.x;
  const ey = q.y - p.y;
  const denominator = dx * ey - dy * ex;
  if (Math.abs(denominator) < 1e-6) return p;
  const t = ((p.x - CX) * ey - (p.y - CY) * ex) / denominator;
  return { x: CX + dx * t, y: CY + dy * t };
}

const OUTER = [1, 1, 1, 1, 1, 1];

/** Animate the focus as a continuous rotation instead of swapping it. */
function useFocusAngle(target: number) {
  const [angle, setAngle] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    // Shortest way round the hexagon: never more than three steps.
    const delta = ((((target - from) % 6) + 9) % 6) - 3 || 0;
    const to = from + delta;
    if (
      to === from ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      current.current = target;
      setAngle(target);
      return;
    }
    const duration = 360 + 90 * Math.abs(to - from);
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-in-out quint: settles without any bounce.
      const eased = t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;
      const value = from + (to - from) * eased;
      current.current = t === 1 ? target : value;
      setAngle(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return angle;
}

const GROW_MS = 900;
const GROW_STAGGER_MS = 80;
const GROW_TOTAL_MS = GROW_MS + GROW_STAGGER_MS * 5;
// One beat after the chart is in view: the total score (counting up over
// 1.1s, mostly there by ~0.5s) lands first, then the shape follows.
const GROW_DELAY_MS = 420;

/**
 * Milliseconds since the chart first came into view (null until then), so the
 * shape draws itself when the reader actually reaches it, like the gauge does.
 */
function useGrowClock(target: React.RefObject<HTMLElement | null>) {
  const [elapsed, setElapsed] = useState<number | null>(null);
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      setElapsed(GROW_TOTAL_MS);
      return;
    }
    let frame = 0;
    let delay = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        delay = window.setTimeout(() => {
          const start = performance.now();
          const tick = (now: number) => {
            const value = Math.min(GROW_TOTAL_MS, now - start);
            setElapsed(value);
            if (value < GROW_TOTAL_MS) frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
        }, GROW_DELAY_MS);
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(delay);
      cancelAnimationFrame(frame);
    };
  }, [target]);
  return elapsed;
}

/** Label anchor per axis: top, upper-right, lower-right, bottom, lower-left, upper-left. */
const LABEL_PLACEMENT = [
  { gap: 20, transform: "translate(-50%, -100%)" },
  { gap: 15, transform: "translate(0, -60%)" },
  { gap: 15, transform: "translate(0, -40%)" },
  { gap: 20, transform: "translate(-50%, 0)" },
  { gap: 15, transform: "translate(-100%, -40%)" },
  { gap: 15, transform: "translate(-100%, -60%)" },
];

/** The lowest scored criterion, or undefined when nothing was scored. */
export function lowestScored(rows: Criterion[]) {
  return rows.reduce<Criterion | undefined>(
    (lowest, row) =>
      row.status === "SCORED" &&
      (!lowest || lowest.status !== "SCORED" || row.score < lowest.score)
        ? row
        : lowest,
    undefined,
  );
}

/**
 * How the score is put together, behind an ⓘ next to the score title: weights,
 * the audio/lip split and the pre-validation note are reference material most
 * readers never need inline.
 */
export function ScoreCriteriaInfo({
  details,
}: {
  details: PublicScoreDetails;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="점수 기준 보기"
        className="-my-2 inline-flex size-8 items-center justify-center rounded-full text-[#b0b8c1] transition-colors hover:text-[#8b95a1] data-[state=open]:text-[#6346f6]"
      >
        <Info size={16} strokeWidth={2} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={6}
          collisionPadding={16}
          className="score-info z-50 w-[264px] rounded-2xl bg-[#191f28] p-4 text-left text-white shadow-[0_12px_32px_-8px_rgb(25_31_40/40%)] outline-none"
        >
          <p className="text-[13px] leading-5 font-bold">점수 기준</p>
          <p className="mt-1 text-xs leading-[18px] text-white/70">
            6개 항목 점수를 아래 비중으로 합산해요.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs leading-4">
            {scoreDetailRows(details).map((row) => (
              <div key={row.criterionId} className="flex justify-between gap-2">
                <dt className="text-white/80">{row.label}</dt>
                <dd className="font-bold tabular-nums">{row.weight}%</dd>
              </div>
            ))}
          </dl>
          {details.aggregationMode === "AUDIO_VISUAL" && (
            <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-[18px] text-white/80">
              종합 점수에 음성 {details.audioWeight}%, 입술{" "}
              {details.visualWeight}%를 반영해요. 음성{" "}
              {formatPublicScore(details.audioScore)}점, 입술{" "}
              {formatPublicScore(details.visualScore)}점이에요.
            </p>
          )}
          <Popover.Arrow className="fill-[#191f28]" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Render only AI-provided display scores; the overall score is never recomputed. */
export function AnalysisScoreDetails({
  details,
  embedded = false,
}: {
  details?: PublicScoreDetails;
  /** Inside the overall-score card: the card already shows the headline score. */
  embedded?: boolean;
}) {
  if (embedded)
    return details ? (
      <div aria-label="항목별 점수">
        <ScoreHexagon details={details} embedded />
      </div>
    ) : null;
  return (
    <section className="rounded-2xl bg-white p-5" aria-label="음성 세부점수">
      <h2 className="flex items-center gap-0.5 text-[15px] font-bold">
        음성 세부점수
        {details && <ScoreCriteriaInfo details={details} />}
      </h2>
      {!details ? (
        <p className="mt-2 text-sm leading-5 text-[#8b95a1]">
          이 결과에는 6개 항목 점수가 없어요.
        </p>
      ) : (
        <ScoreHexagon details={details} embedded={false} />
      )}
    </section>
  );
}

function ScoreHexagon({
  details,
  embedded,
}: {
  details: PublicScoreDetails;
  embedded: boolean;
}) {
  const rows = scoreDetailRows(details);
  const weakest = lowestScored(rows);
  const uid = useId().replace(/:/g, "");
  const [selectedId, setSelectedId] = useState(
    (weakest ?? rows[0]).criterionId,
  );
  const selectedIndex = Math.max(
    0,
    rows.findIndex((row) => row.criterionId === selectedId),
  );
  const selected = rows[selectedIndex];
  const ratios = rows.map((row) =>
    row.status === "SCORED" ? Math.max(0.04, row.score / 100) : 0.04,
  );
  const chart = useRef<HTMLDivElement>(null);
  const elapsed = useGrowClock(chart);
  // Each axis grows out from the centre in turn, clockwise from the top.
  const grown = ratios.map((ratio, index) => {
    if (elapsed == null) return 0;
    const t = Math.min(
      1,
      Math.max(0, (elapsed - index * GROW_STAGGER_MS) / GROW_MS),
    );
    return ratio * (1 - Math.pow(1 - t, 3));
  });
  // Selection marks arrive once the shape has mostly formed.
  const focusOpacity =
    elapsed == null
      ? 0
      : Math.min(1, Math.max(0, (elapsed - GROW_TOTAL_MS * 0.55) / 360));
  const angle = useFocusAngle(selectedIndex);
  const focusEnd = rayHit(angle, OUTER);
  const focusDot = rayHit(angle, grown);

  return (
    <>
      {!embedded && (
        <p className="mt-1 text-sm text-[#4e5968]">
          음성 종합점수{" "}
          <strong className="text-[#191f28] tabular-nums">
            {formatPublicScore(details.audioScore)}
          </strong>{" "}
          / 100점
        </p>
      )}
      <div
        ref={chart}
        data-grown={elapsed != null}
        className="score-hex-chart relative mx-auto mt-3 w-full max-w-[320px]"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            {/* Tied to the score scale, not the shape: near-clear at 0 and
                deepest at 100, so the closer a corner reaches the rim the
                richer it reads. */}
            <radialGradient
              id={`${uid}-fill`}
              gradientUnits="userSpaceOnUse"
              cx={CX}
              cy={CY}
              r={R}
            >
              <stop offset="0%" stopColor="#b3a4ff" stopOpacity="0.04" />
              <stop offset="45%" stopColor="#9a85fc" stopOpacity="0.14" />
              <stop offset="75%" stopColor="#7a5ff8" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#5a3cf0" stopOpacity="0.62" />
            </radialGradient>
            <linearGradient id={`${uid}-stroke`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7347f2" />
              <stop offset="100%" stopColor="#5b7bfa" />
            </linearGradient>
            {/* Focus gradients run from the centre toward the chosen axis. */}
            <radialGradient
              id={`${uid}-beam`}
              gradientUnits="userSpaceOnUse"
              cx={focusEnd.x}
              cy={focusEnd.y}
              r={R * 0.95}
            >
              <stop offset="0%" stopColor="#6346f6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6346f6" stopOpacity="0" />
            </radialGradient>
            <clipPath id={`${uid}-hex`}>
              <polygon points={polygon(rows.map(() => 1))} />
            </clipPath>
            <linearGradient
              id={`${uid}-axis`}
              gradientUnits="userSpaceOnUse"
              x1={CX}
              y1={CY}
              x2={focusEnd.x}
              y2={focusEnd.y}
            >
              <stop offset="0%" stopColor="#6346f6" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#6346f6" />
            </linearGradient>
          </defs>
          {/* Soft alternating bands instead of hard grid lines. */}
          {/* A fat round-joined stroke in the band colour rounds the outer corners. */}
          <polygon
            points={polygon(OUTER)}
            fill="#f6f4fd"
            stroke="#f6f4fd"
            strokeWidth={10}
            strokeLinejoin="round"
          />
          {[...RINGS]
            .reverse()
            .slice(1)
            .map((ring, index) => (
              <polygon
                key={ring}
                points={polygon(rows.map(() => ring))}
                fill={index % 2 === 0 ? "#ffffff" : "#f6f4fd"}
                stroke="#e9e6f5"
                strokeWidth={0.75}
                strokeLinejoin="round"
              />
            ))}
          {/* A soft glow pools in the chosen corner of the hexagon. */}
          <circle
            cx={focusEnd.x}
            cy={focusEnd.y}
            r={R}
            fill={`url(#${uid}-beam)`}
            clipPath={`url(#${uid}-hex)`}
            opacity={focusOpacity}
          />
          {rows.map((row, index) => (
            <line
              key={row.criterionId}
              x1={CX}
              y1={CY}
              x2={point(index, 1).x}
              y2={point(index, 1).y}
              stroke="#e6e4f2"
              strokeWidth={0.75}
              strokeDasharray="2 3"
            />
          ))}
          <g opacity={elapsed == null ? 0 : 1}>
            <polygon
              points={polygon(grown)}
              fill={`url(#${uid}-fill)`}
              stroke={`url(#${uid}-stroke)`}
              strokeWidth={2}
              strokeLinejoin="round"
              className="score-hex-area"
            />
            <line
              x1={CX}
              y1={CY}
              x2={focusEnd.x}
              y2={focusEnd.y}
              opacity={focusOpacity}
              stroke={`url(#${uid}-axis)`}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {rows.map((row, index) => {
              const { x, y } = point(index, grown[index]);
              return (
                <circle
                  key={row.criterionId}
                  cx={x}
                  cy={y}
                  r={3}
                  fill={row.status === "SCORED" ? "#6346f6" : "#b0b8c1"}
                />
              );
            })}
            <g opacity={focusOpacity}>
              <circle
                cx={focusDot.x}
                cy={focusDot.y}
                r={14}
                fill="#6346f6"
                className="score-hex-halo"
              />
              <circle
                cx={focusDot.x}
                cy={focusDot.y}
                r={7}
                fill={selected.status === "SCORED" ? "#6346f6" : "#b0b8c1"}
                stroke="white"
                strokeWidth={3}
                className="score-hex-dot"
              />
            </g>
          </g>
        </svg>

        {/* Labels double as the tap targets for each axis. */}
        {rows.map((row, index) => {
          const { gap, transform } = LABEL_PLACEMENT[index];
          const anchor = point(index, (R + gap) / R);
          const active = index === selectedIndex && focusOpacity > 0;
          return (
            <button
              key={row.criterionId}
              type="button"
              aria-pressed={index === selectedIndex}
              onClick={() => setSelectedId(row.criterionId)}
              className="score-hex-label"
              data-active={active}
              style={{
                left: `${(anchor.x / W) * 100}%`,
                top: `${(anchor.y / H) * 100}%`,
                transform,
                // Labels follow their axis in the same clockwise order.
                ["--enter-delay" as string]: `${120 + index * GROW_STAGGER_MS}ms`,
              }}
            >
              <span className="score-hex-label-name">{row.label}</span>
              <span className="score-hex-label-score">
                {row.status === "SCORED"
                  ? formatPublicScore(row.score)
                  : "평가 불가"}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="mt-3 rounded-[12px] bg-linear-to-br from-[#f6f3ff] to-[#f3f6ff] p-4"
        aria-live="polite"
      >
        {/* The card stays put; only its content crossfades. */}
        <div key={selected.criterionId} className="score-hex-detail">
          {selected === weakest && (
            <p className="mb-1 text-xs leading-4 font-semibold text-[#6346f6]">
              개선이 필요한 영역
            </p>
          )}
          <div className="flex items-baseline gap-3">
            <h3 className="min-w-0 flex-1 text-[15px] leading-[22px] font-bold">
              {selected.label}
            </h3>
            <p className="shrink-0 text-sm whitespace-nowrap text-[#8b95a1] tabular-nums">
              {selected.status === "SCORED" ? (
                <>
                  <strong className="text-[17px] font-bold text-[#191f28]">
                    {formatPublicScore(selected.score)}
                  </strong>{" "}
                  / 100점
                </>
              ) : (
                "평가 불가"
              )}
            </p>
          </div>
          <p className="mt-1.5 text-[13px] leading-5 text-[#4e5968]">
            {selected.status === "UNSCORABLE"
              ? unscorableScoreReason(selected.reasonCode)
              : CRITERION_HINTS[selected.criterionId]}
          </p>
        </div>
      </div>

      {/* Full table for screen readers; the chart above is decorative. */}
      <table className="sr-only">
        <caption>음성 세부점수 표</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.criterionId}>
              <th scope="row">{row.label}</th>
              <td>
                {row.status === "SCORED"
                  ? `${formatPublicScore(row.score)} / 100점`
                  : `평가 불가. ${unscorableScoreReason(row.reasonCode)}`}
              </td>
              <td>음성 종합점수 내부 비중 {row.weight}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
