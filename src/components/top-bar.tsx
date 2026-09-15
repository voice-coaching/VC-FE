"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Link from "next/link";
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
    <header className="relative flex h-16 shrink-0 items-center gap-3 px-5 py-3">
      {onBack ? (
        <button
          onClick={onBack}
          aria-label="이전 단계"
          className="text-foreground transition-opacity hover:opacity-60"
        >
          <NavigationIcon />
        </button>
      ) : (
        <Link
          href={to}
          aria-label="뒤로가기"
          className="text-foreground transition-opacity hover:opacity-60"
        >
          <NavigationIcon />
        </Link>
      )}
      {typeof progress === "number" ? (
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : (
        <h1 className="pointer-events-none absolute inset-x-12 text-center text-[18px] font-bold">
          {title}
        </h1>
      )}
      <div className="ml-auto">{right}</div>
    </header>
  );
}
