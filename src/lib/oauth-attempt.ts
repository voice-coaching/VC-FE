export const OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1_000;

export interface OAuthAttempt {
  state: string;
  redirectUri: string;
  returnTo: string;
  createdAt: number;
  native: boolean;
}

export function readOAuthAttempt(
  storage: Pick<Storage, "getItem">,
  key: string,
  state: string,
): OAuthAttempt | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const attempt = JSON.parse(raw) as OAuthAttempt;
    if (
      !attempt ||
      attempt.state !== state ||
      !Number.isFinite(attempt.createdAt) ||
      attempt.createdAt > Date.now() ||
      Date.now() - attempt.createdAt > OAUTH_ATTEMPT_TTL_MS ||
      typeof attempt.redirectUri !== "string" ||
      typeof attempt.returnTo !== "string"
    )
      return null;
    return attempt;
  } catch {
    return null;
  }
}

export function takeOAuthAttempt(
  storage: Pick<Storage, "getItem" | "removeItem">,
  key: string,
  state: string,
) {
  const attempt = readOAuthAttempt(storage, key, state);
  // A delayed callback must not delete a newer login attempt.
  if (attempt) storage.removeItem(key);
  return attempt;
}
