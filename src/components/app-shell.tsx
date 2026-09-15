"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PrototypeBottomNav } from "@/components/prototype-bottom-nav";

export function BottomNav() {
  return (
    <div className="sticky bottom-0 z-20">
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
  return (
    <div
      className={cn(
        "app-shell learning-shell flex flex-col",
        viewportLocked && "h-dvh min-h-0 overflow-hidden",
      )}
    >
      <main
        className={cn(
          "flex-1",
          viewportLocked && "min-h-0 overflow-hidden",
          className,
        )}
      >
        {children}
      </main>
      {nav ? <BottomNav /> : null}
    </div>
  );
}
