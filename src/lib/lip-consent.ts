// Bump the version if the displayed processing scope changes.
const VERSION = "audio-only-v1";
type ConsentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function key(userId: string) {
  return `lip-practice-consent:${VERSION}:${userId}`;
}

export function readLipConsent(
  userId: string | null,
  storage?: ConsentStorage,
) {
  if (!userId) return false;
  try {
    return (storage ?? window.localStorage).getItem(key(userId)) === "accepted";
  } catch {
    return false;
  }
}

export function writeLipConsent(
  userId: string | null,
  accepted: boolean,
  storage?: ConsentStorage,
) {
  if (!userId) return;
  try {
    const target = storage ?? window.localStorage;
    if (accepted) target.setItem(key(userId), "accepted");
    else target.removeItem(key(userId));
  } catch {
    // Storage may be disabled; the current visit can still use the selected choice.
  }
}
