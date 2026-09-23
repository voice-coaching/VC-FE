const CACHE_VERSION = 1;
const CACHE_PREFIX = `speakai.cache.v${CACHE_VERSION}.user.`;

export const CLIENT_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const CLIENT_CACHE_DAY_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const CLIENT_CACHE_SHORT_MAX_AGE_MS = 6 * 60 * 60 * 1_000;
export const CLIENT_CACHE_LIVE_MAX_AGE_MS = 30 * 60 * 1_000;

type CacheEnvelope<T> = {
  version: number;
  savedAt: number;
  value: T;
};

function cacheKey(userId: string | null, resource: string) {
  if (!userId) return null;
  return `${CACHE_PREFIX}${encodeURIComponent(userId)}.${encodeURIComponent(resource)}`;
}

export function readUserClientCache<T>(
  userId: string | null,
  resource: string,
  maxAgeMs = CLIENT_CACHE_MAX_AGE_MS,
): T | null {
  const key = cacheKey(userId, resource);
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    const valid =
      envelope.version === CACHE_VERSION &&
      Number.isFinite(envelope.savedAt) &&
      Date.now() - envelope.savedAt <= maxAgeMs;
    if (!valid) {
      window.localStorage.removeItem(key);
      return null;
    }
    return envelope.value;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage access restrictions.
    }
    return null;
  }
}

export function writeUserClientCache<T>(
  userId: string | null,
  resource: string,
  value: T,
) {
  const key = cacheKey(userId, resource);
  if (!key || typeof window === "undefined") return;

  try {
    const envelope: CacheEnvelope<T> = {
      version: CACHE_VERSION,
      savedAt: Date.now(),
      value,
    };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Storage may be unavailable or full. The network response remains usable.
  }
}

export function updateUserClientCache<T extends object>(
  userId: string | null,
  resource: string,
  patch: Partial<T>,
) {
  const current = readUserClientCache<T>(userId, resource) ?? ({} as T);
  writeUserClientCache(userId, resource, { ...current, ...patch });
}

export function removeUserClientCache(userId: string | null, resource: string) {
  const key = cacheKey(userId, resource);
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort cleanup for browsers that restrict localStorage access.
  }
}

export function removeUserClientCacheGroup(
  userId: string | null,
  resourcePrefix: string,
) {
  if (!userId || typeof window === "undefined") return;
  const userPrefix = `${CACHE_PREFIX}${encodeURIComponent(userId)}.`;

  try {
    const keys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    ).filter((key): key is string => {
      if (!key?.startsWith(userPrefix)) return false;
      try {
        return decodeURIComponent(key.slice(userPrefix.length)).startsWith(
          resourcePrefix,
        );
      } catch {
        return false;
      }
    });
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Best-effort cleanup for browsers that restrict localStorage access.
  }
}

export function clearUserClientCache(userId?: string | null) {
  if (typeof window === "undefined") return;
  const prefix = userId
    ? `${CACHE_PREFIX}${encodeURIComponent(userId)}.`
    : CACHE_PREFIX;

  try {
    const keys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    ).filter((key): key is string => Boolean(key?.startsWith(prefix)));
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Best-effort cleanup for browsers that restrict localStorage access.
  }
}
