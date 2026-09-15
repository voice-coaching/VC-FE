"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PrototypeBottomNav } from "@/components/prototype-bottom-nav";

export function BottomNav() {
  return (
    <div className="relative z-20 shrink-0">
      <PrototypeBottomNav />
    </div>
  );
}

export function AppShell({
  children,
  nav = true,
  className,
  viewportLocked = false,
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
  viewportLocked?: boolean;
}) {
  const lockViewport = nav || viewportLocked;

  return (
    <div
      className={cn(
        "app-shell learning-shell flex flex-col",
        lockViewport && "h-dvh min-h-0 overflow-hidden",
      )}
    >
      <main
        className={cn(
          "flex-1",
          lockViewport && "min-h-0",
          viewportLocked
            ? "overflow-hidden"
            : nav && "overflow-y-auto overscroll-y-contain",
          className,
        )}
      >
        {children}
      </main>
      {nav ? <BottomNav /> : null}
    </div>
  );
}
