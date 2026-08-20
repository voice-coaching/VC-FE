import type { SocialProvider } from "./api";

const OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1_000;

export interface OAuthAttempt {
  state: string;
  redirectUri: string;
  returnTo: string;
  createdAt: number;
}

function storageKey(provider: SocialProvider) {
  return `ttobak.oauth.${provider.toLowerCase()}`;
}

function randomState() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function providerConfiguration(provider: SocialProvider) {
  switch (provider) {
    case "GOOGLE":
      return {
        value:
          process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
          process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL,
        endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        scope: "openid email profile",
      };
    case "KAKAO":
      return {
        value:
          process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY ??
          process.env.NEXT_PUBLIC_KAKAO_AUTH_URL,
        endpoint: "https://kauth.kakao.com/oauth/authorize",
      };
    case "NAVER":
      return {
        value:
          process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ??
          process.env.NEXT_PUBLIC_NAVER_AUTH_URL,
        endpoint: "https://nid.naver.com/oauth2.0/authorize",
      };
    case "APPLE":
      return {
        value: process.env.NEXT_PUBLIC_APPLE_AUTH_URL,
        endpoint: "https://appleid.apple.com/auth/authorize",
      };
  }
}

function configuredRedirectUri(provider: SocialProvider) {
  const redirectUris: Record<SocialProvider, string | undefined> = {
    GOOGLE: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
    KAKAO: process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI,
    NAVER: process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI,
    APPLE: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI,
  };
  const value = redirectUris[provider]?.trim();
  if (!value) return null;

  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error(
      `${provider} OAuth 리다이렉트 URI 형식이 올바르지 않습니다.`,
    );
  }
  return url.toString();
}

export function createOAuthAttempt(
  provider: SocialProvider,
  returnTo = "/home",
) {
  const attempt: OAuthAttempt = {
    state: randomState(),
    redirectUri:
      configuredRedirectUri(provider) ??
      `${window.location.origin}/oauth/${provider.toLowerCase()}/callback`,
    returnTo,
    createdAt: Date.now(),
  };
  window.sessionStorage.setItem(storageKey(provider), JSON.stringify(attempt));
  return attempt;
}

export function getOAuthAuthorizationUrl(
  provider: SocialProvider,
  attempt: OAuthAttempt,
) {
  const configuration = providerConfiguration(provider);
  const value = configuration.value?.trim();
  if (!value) {
    throw new Error(`${provider} OAuth 설정이 없습니다.`);
  }

  const isAuthorizationUrl = /^https?:\/\//i.test(value);
  const url = new URL(isAuthorizationUrl ? value : configuration.endpoint);

  if (!isAuthorizationUrl) url.searchParams.set("client_id", value);
  url.searchParams.set("redirect_uri", attempt.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", attempt.state);

  if (configuration.scope && !url.searchParams.has("scope")) {
    url.searchParams.set("scope", configuration.scope);
  }
  if (provider === "GOOGLE" && !url.searchParams.has("prompt")) {
    url.searchParams.set("prompt", "select_account");
  }

  return url.toString();
}

export function isOAuthProviderConfigured(provider: SocialProvider) {
  return Boolean(providerConfiguration(provider).value?.trim());
}

export function consumeOAuthAttempt(provider: SocialProvider, state: string) {
  const key = storageKey(provider);
  const raw = window.sessionStorage.getItem(key);
  window.sessionStorage.removeItem(key);
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
  window.sessionStorage.removeItem(storageKey(provider));
}
