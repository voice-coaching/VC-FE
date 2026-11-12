"use client";

import { useEffect, useRef, useState } from "react";

/** How long the finished check stays before the report takes over. */
export const ANALYSIS_FINISH_MS = 1500;

/**
 * True for a short beat after an analysis the user was watching succeeds, so
 * the loading screen can play its finished state (ring closes into a purple
 * check) before the report appears. Results that were already done when the
 * screen opened, failures, and reduced-motion users skip the beat.
 */
export function useAnalysisFinish(busy: boolean, succeeded: boolean) {
  const watched = useRef(false);
  const [finishing, setFinishing] = useState(false);
  useEffect(() => {
    if (busy) {
      watched.current = true;
      setFinishing(false);
      return;
    }
    if (!watched.current || !succeeded) return;
    watched.current = false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFinishing(true);
  }, [busy, succeeded]);
  useEffect(() => {
    if (!finishing) return;
    const timer = window.setTimeout(
      () => setFinishing(false),
      ANALYSIS_FINISH_MS,
    );
    return () => window.clearTimeout(timer);
  }, [finishing]);
  return finishing;
}
