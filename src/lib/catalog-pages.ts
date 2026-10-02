import type { PageResult, PracticeContentSummary } from "./api/types";

/** Refresh the loaded window atomically so Back does not discard later pages. */
export async function refreshCatalogWindow(
  fetchPage: (page: number) => Promise<PageResult<PracticeContentSummary>>,
  lastPage: number,
  isCurrent: () => boolean,
) {
  const end = Number.isSafeInteger(lastPage) && lastPage > 0 ? lastPage : 0;
  const items = new Map<string, PracticeContentSummary>();
  for (let page = 0; page <= end; page += 1) {
    if (!isCurrent()) return null;
    const result = await fetchPage(page);
    if (!isCurrent()) return null;
    for (const item of result.items) items.set(String(item.id), item);
    if (!result.hasNext || page === end)
      return { ...result, items: [...items.values()] };
  }
  return null;
}
