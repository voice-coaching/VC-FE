import type { SocialProvider } from "./api";

const OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1_000;

export interface OAuthAttempt {
  state: string;
  redirectUri: string;
  createdAt: number;
}

function key(provider: SocialProvider) {
  return `ttobak.oauth.${provider.toLowerCase()}`;
}

function randomState() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function createOAuthAttempt(provider: SocialProvider) {
  const attempt: OAuthAttempt = {
    state: randomState(),
    redirectUri: `${window.location.origin}/oauth/${provider.toLowerCase()}/callback`,
    createdAt: Date.now(),
  };
  window.sessionStorage.setItem(key(provider), JSON.stringify(attempt));
  return attempt;
}

export function getOAuthAuthorizationUrl(
  provider: SocialProvider,
  attempt: OAuthAttempt,
) {
  if (provider === "GOOGLE") {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("Google Client ID가 설정되지 않았습니다.");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: attempt.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: attempt.state,
      prompt: "select_account",
    }).toString();
    return url.toString();
  }

  const clientId = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
  if (!clientId) throw new Error("Kakao REST API Key가 설정되지 않았습니다.");
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: attempt.redirectUri,
    response_type: "code",
    state: attempt.state,
  }).toString();
  return url.toString();
}

export function consumeOAuthAttempt(provider: SocialProvider, state: string) {
  const storageKey = key(provider);
  const raw = window.sessionStorage.getItem(storageKey);
  window.sessionStorage.removeItem(storageKey);
  if (!raw) return null;
  try {
    const attempt = JSON.parse(raw) as OAuthAttempt;
    if (
      attempt.state !== state ||
      Date.now() - attempt.createdAt > OAUTH_ATTEMPT_TTL_MS
    ) {
      return null;
    }
    return attempt;
  } catch {
    return null;
  }
}

export function clearOAuthAttempt(provider: SocialProvider) {
  window.sessionStorage.removeItem(key(provider));
}
