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
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
}) {
  return (
    <div className="app-shell learning-shell flex flex-col">
      <main className={cn("flex-1", className)}>{children}</main>
      {nav ? <BottomNav /> : null}
    </div>
  );
}
