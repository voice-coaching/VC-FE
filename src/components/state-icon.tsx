import type { LucideIcon } from "lucide-react";

const TONES = {
  brand: { ring: "#f1edff", fill: "#e6dfff", ink: "#6346f6" },
  danger: { ring: "#fff1f2", fill: "#ffe2e5", ink: "#f04452" },
} as const;

/**
 * A soft two-ring disc with one icon: the shared stand-in for state
 * illustrations (empty, loading, failed, done) now that character art is
 * no longer used.
 */
export function StateIcon({
  icon: Icon,
  tone = "brand",
  size = 88,
  className = "",
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  size?: number;
  className?: string;
}) {
  const colors = TONES[tone];
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size, background: colors.ring }}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: size * 0.68,
          height: size * 0.68,
          background: colors.fill,
          color: colors.ink,
        }}
      >
        <Icon size={Math.round(size * 0.34)} strokeWidth={2} />
      </span>
    </span>
  );
}
