"use client";

import {
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
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

// These views share the same profile header and should switch without sliding it.
const staticMyPageTabs = new Set([
  "/mypage",
  "/mypage/history",
  "/mypage/plan",
]);

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
  bottomChromeColor,
  mainRef,
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
  viewportLocked?: boolean;
  chromeColor?: string;
  bottomChromeColor?: string;
  mainRef?: Ref<HTMLElement>;
}) {
  const pathname = usePathname();
  const lockViewport = nav || viewportLocked;
  const animateTabFlow = tabFlowPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const animateContent = animateTabFlow && !staticMyPageTabs.has(pathname);
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
        chromeColor || bottomChromeColor
          ? ({
              "--app-chrome-background": chromeColor,
              "--app-bottom-background": bottomChromeColor,
            } as CSSProperties)
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
        ref={mainRef}
        key={animateTabFlow ? pathname : undefined}
        onClickCapture={
          animateTabFlow ? () => setTabTransitionDirection("right") : undefined
        }
        className={cn(
          "flex-1",
          lockViewport && "min-h-0",
          animateContent && styles.tabContent,
          animateContent &&
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
