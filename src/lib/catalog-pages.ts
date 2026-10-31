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

/** One complete snapshot per visit; filters share pending reads and loaded data. */
export function createCatalogSnapshot<T extends { id: Id }>(
  fetchPage: (page: number) => Promise<PageResult<T>>,
  isCurrent: () => boolean,
) {
  let snapshot: T[] | null = null;
  let pending: Promise<T[] | null> | null = null;
  return {
    read(): Promise<T[] | null> {
      if (!isCurrent()) return Promise.resolve(null);
      if (snapshot) return Promise.resolve(snapshot);
      if (pending) return pending;
      pending = (async () => {
        const items = new Map<string, T>();
        for (let page = 0; ; page++) {
          if (!isCurrent()) return null;
          const result = await fetchPage(page);
          if (!isCurrent()) return null;
          for (const item of result.items) items.set(String(item.id), item);
          const more =
            result.hasNext ??
            page + 1 <
              (result.totalPages ??
                Math.ceil(result.totalElements / result.size));
          if (!more) {
            snapshot = [...items.values()];
            return snapshot;
          }
          if (!result.items.length)
            throw new Error("콘텐츠 목록의 다음 페이지를 확인할 수 없습니다.");
        }
      })().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}
