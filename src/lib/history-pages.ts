import type { PageResult, TrainingHistoryItem } from "./api/types";

export function mergeHistoryItems(
  current: TrainingHistoryItem[],
  incoming: TrainingHistoryItem[],
) {
  const items = new Map(current.map((item) => [String(item.sessionId), item]));
  for (const item of incoming) items.set(String(item.sessionId), item);
  return [...items.values()];
}

/** Publish a refreshed window atomically, without dropping previously loaded pages. */
export async function refreshHistoryWindow(
  fetchPage: (page: number) => Promise<PageResult<TrainingHistoryItem>>,
  lastPage: number,
  isCurrent: () => boolean,
) {
  const end = Number.isSafeInteger(lastPage) && lastPage > 0 ? lastPage : 0;
  let items: TrainingHistoryItem[] = [];
  for (let page = 0; page <= end; page += 1) {
    if (!isCurrent()) return null;
    const result = await fetchPage(page);
    if (!isCurrent()) return null;
    items = mergeHistoryItems(items, result.items);
    if (!result.hasNext || page === end) {
      return { items, page: result.page, hasNext: Boolean(result.hasNext) };
    }
  }
  return null;
}
