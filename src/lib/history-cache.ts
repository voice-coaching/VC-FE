import type { ContentType, Id, TrainingHistoryItem } from "./api/types";
import { readUserClientCache, writeUserClientCache } from "./client-cache";

export type HistoryCache = {
  items: TrainingHistoryItem[];
  page: number;
  hasNext: boolean;
};

export function historyCacheResource(kind?: ContentType) {
  return `mypage-history-${kind ?? "all"}`;
}

/** Retain the loaded window so deleting one row does not discard pagination. */
export function removeCachedHistorySession(
  userId: string | null,
  sessionId: Id,
) {
  const kinds: Array<ContentType | undefined> = [
    undefined,
    "NEWS",
    "SENTENCE",
    "ANNOUNCER",
    "CLASS_PRACTICE",
  ];
  for (const kind of kinds) {
    const resource = historyCacheResource(kind);
    const cached = readUserClientCache<HistoryCache>(userId, resource);
    if (!cached || !Array.isArray(cached.items)) continue;
    writeUserClientCache(userId, resource, {
      ...cached,
      items: cached.items.filter(
        (item) => String(item.sessionId) !== String(sessionId),
      ),
    });
  }
}
