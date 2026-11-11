"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
  "/saved",
  "/news",
  "/sentences",
  "/my-script",
  "/announcer",
  "/practice",
  "/lip-practice",
];

// These views share the same profile header and should switch without sliding it.
/** Section shown last under the bottom nav; survives page remounts. */
let lastNavSection: string | null = null;
const navSection = (path: string) =>
  path.startsWith("/mypage/history") ? "/history" : `/${path.split("/")[1]}`;

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
  animateRoute = true,
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
  viewportLocked?: boolean;
  chromeColor?: string;
  bottomChromeColor?: string;
  mainRef?: Ref<HTMLElement>;
  animateRoute?: boolean;
}) {
  const pathname = usePathname();
  const lockViewport = nav || viewportLocked;
  const animateTabFlow =
    animateRoute &&
    tabFlowPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  // Bottom-nav screens all share one switch effect (below), so the per-route
  // slide never runs there; every tab change looks identical.
  const animateContent =
    animateTabFlow && !nav && !staticMyPageTabs.has(pathname);
  const shellMain = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!nav) return;
    const section = navSection(pathname);
    const changed = lastNavSection !== null && lastNavSection !== section;
    lastNavSection = section;
    const element = shellMain.current;
    if (
      !changed ||
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    element.animate(
      [
        { opacity: 0, transform: "translate3d(0, 8px, 0)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [nav, pathname]);
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
        ref={(element) => {
          shellMain.current = element;
          if (typeof mainRef === "function") mainRef(element);
          else if (mainRef)
            (mainRef as { current: HTMLElement | null }).current = element;
        }}
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
