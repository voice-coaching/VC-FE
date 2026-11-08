const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
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

/** The ordinary close action does not call this; only the explicit weekly hide button persists a choice. */
export function hideHomePopupForWeek(
  userId: string,
  popupId: number,
  now = Date.now(),
  storage = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey(userId, popupId), String(now + WEEK_MS));
    return true;
  } catch {
    return false;
  }
}
