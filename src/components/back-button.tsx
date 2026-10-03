"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { canNavigateBack } from "@/lib/navigation-history";
import { requestNavigation, safeInternalPath } from "@/lib/navigation";

export function BackButton({
  fallback,
  children,
  className,
  label = "뒤로가기",
}: {
  fallback: string;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const lastClick = useRef(0);
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onClick={() => {
        const now = Date.now();
        if (now - lastClick.current < 500) return;
        lastClick.current = now;
        requestNavigation(() => {
          if (canNavigateBack(window.history.state)) router.back();
          else router.replace(safeInternalPath(fallback, "/home"));
        });
      }}
    >
      {children}
    </button>
  );
}
