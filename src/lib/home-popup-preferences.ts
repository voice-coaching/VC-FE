const DAY_MS = 24 * 60 * 60 * 1000;
type PopupStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): PopupStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function storageKey(userId: string, popupId: number): string {
  return `speakai.popup-hidden-until.v1:${encodeURIComponent(userId)}:${popupId}`;
}

/** A local preference scoped to this browser, account and popup. It never changes server publication dates. */
export function isHomePopupHidden(
  userId: string,
  popupId: number,
  now = Date.now(),
  storage = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    const key = storageKey(userId, popupId);
    const raw = storage.getItem(key);
    if (raw === null) return false;
    const expiresAt = Number(raw);
    if (Number.isFinite(expiresAt) && expiresAt > now) return true;
    storage.removeItem(key);
  } catch {
    // Restricted or corrupt storage must never prevent opening the home page.
  }
  return false;
}

/** Only an explicit hide action persists a preference; X/Escape/backdrop close stay visit-only. */
export function hideHomePopupForDays(
  userId: string,
  popupId: number,
  days: 1 | 7,
  now = Date.now(),
  storage = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey(userId, popupId), String(now + days * DAY_MS));
    return true;
  } catch {
    return false;
  }
}

export function hideHomePopupForWeek(
  userId: string,
  popupId: number,
  now = Date.now(),
  storage = browserStorage(),
): boolean {
  return hideHomePopupForDays(userId, popupId, 7, now, storage);
}
