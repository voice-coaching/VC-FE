import { cn } from "@/lib/utils";

// 화면에 들어갈 때 실제 레이아웃 모양대로 보여주는 회색 자리표시 블록.
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-full bg-[#f2f4f6]", className)}
    />
  );
}
