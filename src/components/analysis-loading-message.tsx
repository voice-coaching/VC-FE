"use client";

import { useEffect, useState } from "react";
import {
  ANALYSIS_MESSAGES,
  ANALYSIS_MESSAGE_INTERVAL_MS,
  nextAnalysisMessageIndex,
} from "@/lib/analysis-messages";

export function AnalysisLoadingMessage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * ANALYSIS_MESSAGES.length));
    const timer = window.setInterval(() => {
      setIndex((current) => nextAnalysisMessageIndex(current));
    }, ANALYSIS_MESSAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span role="status" aria-live="polite" aria-atomic="true">
      {ANALYSIS_MESSAGES[index]}
    </span>
  );
}
