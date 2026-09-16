import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import type { SocialProvider } from "./api";

const OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1_000;
const NATIVE_STATE_PREFIX = "native.";
export const NATIVE_OAUTH_SCHEME = "speakai";

export interface OAuthAttempt {
  state: string;
  redirectUri: string;
  returnTo: string;
  createdAt: number;
  native: boolean;
}

function storageKey(provider: SocialProvider) {
  return `ttobak.oauth.${provider.toLowerCase()}`;
}

function attemptStorage(native: boolean) {
  return native ? window.localStorage : window.sessionStorage;
}

export function isNativeOAuthState(state?: string) {
  return Boolean(state?.startsWith(NATIVE_STATE_PREFIX));
}

function randomState() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function normalizeProviderConfiguration({
  clientId,
  legacyValue,
  endpoint,
  scope,
}: {
  clientId?: string;
  legacyValue?: string;
  endpoint: string;
  scope?: string;
}) {
  const value = clientId?.trim() || legacyValue?.trim();
  if (!value) return { clientId: undefined, endpoint, scope };
  if (!/^https?:\/\//i.test(value)) return { clientId: value, endpoint, scope };

  const legacyUrl = new URL(value);
  return {
    clientId: legacyUrl.searchParams.get("client_id")?.trim() || undefined,
    endpoint: legacyUrl.toString(),
    scope,
  };
}

function providerConfiguration(provider: SocialProvider) {
  switch (provider) {
    case "GOOGLE":
      return normalizeProviderConfiguration({
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        legacyValue: process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL,
        endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        scope: "openid email profile",
      });
    case "KAKAO":
      return normalizeProviderConfiguration({
        clientId: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY,
        legacyValue: process.env.NEXT_PUBLIC_KAKAO_AUTH_URL,
        endpoint: "https://kauth.kakao.com/oauth/authorize",
      });
    case "NAVER":
      return normalizeProviderConfiguration({
        clientId: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID,
        legacyValue: process.env.NEXT_PUBLIC_NAVER_AUTH_URL,
        endpoint: "https://nid.naver.com/oauth2.0/authorize",
      });
    case "APPLE":
      return normalizeProviderConfiguration({
        legacyValue: process.env.NEXT_PUBLIC_APPLE_AUTH_URL,
        endpoint: "https://appleid.apple.com/auth/authorize",
      });
  }
}

function redirectUri(provider: SocialProvider) {
  const redirectUris: Record<SocialProvider, string | undefined> = {
    GOOGLE: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
    KAKAO: process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI,
    NAVER: process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI,
    APPLE: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI,
  };
  const sameOriginFallback = new URL(
    `/oauth/${provider.toLowerCase()}/callback`,
    window.location.origin,
  ).toString();
  const value = redirectUris[provider]?.trim();
  if (!value) return sameOriginFallback;

  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error(
      `${provider} OAuth 리다이렉트 URI 형식이 올바르지 않습니다.`,
    );
  }
  // OAuth state는 현재 origin의 storage에 보관되므로 콜백도 반드시 같은
  // origin으로 돌아와야 한다. 운영 앱에서 localhost 개발 설정이 섞여 있어도
  // 현재 배포 origin의 콜백으로 자동 보정한다.
  return url.origin === window.location.origin
    ? url.toString()
    : sameOriginFallback;
}

export function createOAuthAttempt(
  provider: SocialProvider,
  returnTo = "/home",
) {
  const native = Capacitor.isNativePlatform();
  const attempt: OAuthAttempt = {
    state: native ? `${NATIVE_STATE_PREFIX}${randomState()}` : randomState(),
    redirectUri: redirectUri(provider),
    returnTo,
    createdAt: Date.now(),
    native,
  };
  attemptStorage(native).setItem(storageKey(provider), JSON.stringify(attempt));
  return attempt;
}

export function getOAuthAuthorizationUrl(
  provider: SocialProvider,
  attempt: OAuthAttempt,
) {
  const configuration = providerConfiguration(provider);
  const clientId = configuration.clientId;
  if (!clientId) {
    throw new Error(`${provider} OAuth 설정이 없습니다.`);
  }

  const url = new URL(configuration.endpoint);
  url.searchParams.set("client_id", clientId);
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
  return Boolean(providerConfiguration(provider).clientId);
}

export async function redirectToOAuthProvider(
  provider: SocialProvider,
  returnTo = "/home",
) {
  const attempt = createOAuthAttempt(provider, returnTo);
  try {
    const authorizationUrl = getOAuthAuthorizationUrl(provider, attempt);
    if (attempt.native) {
      await Browser.open({
        url: authorizationUrl,
        presentationStyle: "popover",
      });
    } else {
      window.location.assign(authorizationUrl);
    }
  } catch (reason) {
    clearOAuthAttempt(provider);
    throw reason;
  }
}

export function consumeOAuthAttempt(provider: SocialProvider, state: string) {
  const key = storageKey(provider);
  const storage = attemptStorage(isNativeOAuthState(state));
  const raw = storage.getItem(key);
  storage.removeItem(key);
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
  window.localStorage.removeItem(storageKey(provider));
}

export function createNativeOAuthCallbackUrl(
  provider: SocialProvider,
  params: URLSearchParams,
) {
  const query = params.toString();
  return `${NATIVE_OAUTH_SCHEME}://oauth/${provider.toLowerCase()}/callback${query ? `?${query}` : ""}`;
}

export function parseNativeOAuthCallback(urlValue: string) {
  const url = new URL(urlValue);
  if (url.protocol !== `${NATIVE_OAUTH_SCHEME}:` || url.hostname !== "oauth") {
    return null;
  }
  const match = url.pathname.match(/^\/(google|kakao|naver|apple)\/callback$/);
  if (!match) return null;
  return {
    provider: match[1]!.toUpperCase() as SocialProvider,
    searchParams: url.searchParams,
  };
}
