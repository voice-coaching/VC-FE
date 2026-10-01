"use client";

import { useLayoutEffect, useRef } from "react";
import {
  installNavigationHistory,
  navigationEntryId,
} from "@/lib/navigation-history";

// Entry-scoped rather than URL-scoped: a fresh visit starts at the top.
// Only numeric offsets are retained, and memory is bounded for long sessions.
const positions = new Map<string, number>();
const MAX_POSITIONS = 100;

export function useHistoryScroll(scope: string, ready: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!ready || !element) return;
    installNavigationHistory(window.history);
    const entryId = navigationEntryId(window.history.state);
    if (!entryId) return;
    const key = `${entryId}:${scope}`;

    // Wait for data to render before restoring; an empty loading shell clamps
    // scrollTop to zero and would otherwise erase the previous position.
    element.scrollTop = positions.get(key) ?? 0;
    const save = () => {
      positions.delete(key);
      positions.set(key, element.scrollTop);
      if (positions.size > MAX_POSITIONS) {
        positions.delete(positions.keys().next().value!);
      }
    };
    save();
    element.addEventListener("scroll", save, { passive: true });
    return () => {
      element.removeEventListener("scroll", save);
    };
  }, [scope, ready]);

  return ref;
}
