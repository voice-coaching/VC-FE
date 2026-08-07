"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function TopBar({
  to,
  progress,
  right,
  title,
  onBack,
}: {
  to: string;
  progress?: number;
  right?: ReactNode;
  title?: string;
  onBack?: () => void;
}) {
  return (
    <header className="flex items-center gap-3 px-5 pt-6 pb-4">
      {onBack ? (
        <button
          onClick={onBack}
          aria-label="이전 단계"
          className="text-foreground transition-opacity hover:opacity-60"
        >
          <ArrowLeft className="size-5" />
        </button>
      ) : (
        <Link
          href={to}
          aria-label="뒤로가기"
          className="text-foreground transition-opacity hover:opacity-60"
        >
          <ArrowLeft className="size-5" />
        </Link>
      )}
      {typeof progress === "number" ? (
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : (
        <span className="flex-1 text-sm font-semibold">{title}</span>
      )}
      {right}
    </header>
  );
}
