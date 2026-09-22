"use client";

import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getTabTransitionDirection,
  setTabTransitionDirection,
} from "@/lib/tab-transition";
import { PrototypeBottomNav } from "@/components/prototype-bottom-nav";
import styles from "./app-shell.module.css";

const tabFlowPrefixes = [
  "/home",
  "/class",
  "/mypage",
  "/news",
  "/sentences",
  "/my-script",
  "/announcer",
  "/practice",
  "/lip-practice",
];

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
  chromeColor,
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
  viewportLocked?: boolean;
  chromeColor?: string;
}) {
  const pathname = usePathname();
  const lockViewport = nav || viewportLocked;
  const animateTabFlow = tabFlowPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const transitionDirection = useMemo(() => {
    void pathname;
    return getTabTransitionDirection();
  }, [pathname]);

  useEffect(() => {
    setTabTransitionDirection("right");
  }, [pathname]);

  return (
    <div
      style={
        chromeColor
          ? ({ "--app-chrome-background": chromeColor } as CSSProperties)
          : undefined
      }
      className={cn(
        "app-shell learning-shell flex flex-col",
        styles.safeAreaShell,
        !nav && styles.standaloneSafeArea,
        lockViewport && "h-dvh min-h-0 overflow-hidden",
        animateTabFlow && styles.tabFlow,
      )}
    >
      <main
        key={animateTabFlow ? pathname : undefined}
        onClickCapture={
          animateTabFlow ? () => setTabTransitionDirection("right") : undefined
        }
        className={cn(
          "flex-1",
          lockViewport && "min-h-0",
          animateTabFlow && styles.tabContent,
          animateTabFlow &&
            (transitionDirection === "left"
              ? styles.fromLeft
              : styles.fromRight),
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
