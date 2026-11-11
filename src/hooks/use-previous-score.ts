"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Id, TrainingHistoryItem } from "@/lib/api/types";

export type PreviousScore = {
  score: number;
  /**
   * "retake": this sentence's previous take in the same run; "content": an
   * earlier attempt at this same content; "recent": the latest other practice.
   */
  scope: "retake" | "content" | "recent";
};

// Sentence tabs remount the report per sentence; share one recent fetch.
let cached: { at: number; promise: Promise<TrainingHistoryItem[]> } | null =
  null;
function recentSessions() {
  if (!cached || Date.now() - cached.at > 60_000)
    cached = {
      at: Date.now(),
      promise: api.myPage
        .listTrainingSessions({ status: "COMPLETED", page: 0, size: 50 })
        .then((page) => page.items)
        .catch(() => []),
    };
  return cached.promise;
}

/** Picks the comparison point from the user's server-side history; never invents one. */
export function pickPreviousScore(
  items: TrainingHistoryItem[],
  contentId: Id,
  sessionId: Id,
  /** Sessions from the same multi-sentence run: other sentences, not "earlier". */
  exclude: ReadonlyArray<Id> = [],
): PreviousScore | null {
  const skip = new Set(exclude.map(String));
  const current = items.find(
    (item) => String(item.sessionId) === String(sessionId),
  );
  const earlier = items
    .filter(
      (item) =>
        String(item.sessionId) !== String(sessionId) &&
        !skip.has(String(item.sessionId)) &&
        item.overallScore != null &&
        (!current || item.completedAt < current.completedAt),
    )
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const same = earlier.find(
    (item) => String(item.contentId) === String(contentId),
  );
  if (same) return { score: same.overallScore!, scope: "content" };
  if (earlier[0]) return { score: earlier[0].overallScore!, scope: "recent" };
  return null;
}

export function usePreviousScore(
  contentId: Id,
  sessionId: Id | null | undefined,
  override?: PreviousScore | null,
  exclude?: ReadonlyArray<Id>,
) {
  const excludeKey = exclude?.map(String).join(",") ?? "";
  const [previous, setPrevious] = useState<PreviousScore | null>(null);
  useEffect(() => {
    if (override !== undefined || sessionId == null) return;
    let active = true;
    void recentSessions().then((items) => {
      if (active)
        setPrevious(
          pickPreviousScore(
            items,
            contentId,
            sessionId,
            excludeKey ? excludeKey.split(",") : [],
          ),
        );
    });
    return () => {
      active = false;
    };
  }, [contentId, sessionId, override, excludeKey]);
  return override !== undefined ? override : previous;
}
