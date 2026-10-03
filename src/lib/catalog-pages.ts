import type { Id, PageResult } from "./api/types";

/** Refresh the loaded window atomically so Back does not discard later pages. */
export async function refreshCatalogWindow<T extends { id: Id }>(
  fetchPage: (page: number) => Promise<PageResult<T>>,
  lastPage: number,
  isCurrent: () => boolean,
) {
  const end = Number.isSafeInteger(lastPage) && lastPage > 0 ? lastPage : 0;
  const items = new Map<string, T>();
  for (let page = 0; page <= end; page += 1) {
    if (!isCurrent()) return null;
    const result = await fetchPage(page);
    if (!isCurrent()) return null;
    for (const item of result.items) items.set(String(item.id), item);
    const hasNext =
      result.hasNext ?? result.page + 1 < (result.totalPages ?? 0);
    if (!hasNext || page === end)
      return { ...result, hasNext, items: [...items.values()] };
  }
  return null;
}
