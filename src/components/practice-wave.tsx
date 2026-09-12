"use client";
import styles from "@/components/announcer-result.module.css";
const BARS = [
  10, 20, 32, 16, 38, 24, 12, 30, 42, 22, 12, 28, 36, 18, 26, 20, 34, 14, 24,
  16, 30, 20,
];
export function PracticeWave({
  active,
  compact = false,
  pale = false,
  tone = "primary",
}: {
  active: boolean;
  compact?: boolean;
  pale?: boolean;
  tone?: "primary" | "neutral";
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex min-w-0 items-center justify-center overflow-hidden ${compact ? "h-9 gap-[3px]" : "h-12 gap-1"}`}
    >
      {BARS.map((height, index) => (
        <span
          key={index}
          className={`${styles.bar} shrink-0 rounded-full transition-colors duration-300 ${compact ? "w-[3px]" : "w-1"} ${pale ? "bg-white/65" : active ? (tone === "neutral" ? "bg-[#6b7684]" : "bg-[#2f6bff]") : "bg-[#c3c8d0]"}`}
          style={{
            height: compact ? height * 0.75 : height,
            animationDelay: `${index * -73}ms`,
            animationDuration: `${850 + (index % 5) * 90}ms`,
            animationPlayState: active ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}
