import type { SocialProvider } from "./api/types";

const NATIVE_STATE_PREFIX = "native.";
export const NATIVE_OAUTH_SCHEME = "speakai";

export function isNativeOAuthState(state?: string) {
  return Boolean(state?.startsWith(NATIVE_STATE_PREFIX));
}

export function createNativeOAuthState(randomValue: string) {
  return `${NATIVE_STATE_PREFIX}${randomValue}`;
}

export function createNativeOAuthCallbackUrl(
  provider: SocialProvider,
  params: URLSearchParams,
) {
  const query = params.toString();
  return `${NATIVE_OAUTH_SCHEME}://oauth/${provider.toLowerCase()}/callback${query ? `?${query}` : ""}`;
}

export function createNativeOAuthCallbackUrlFromResponse(
  provider: SocialProvider,
  response: {
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
  },
) {
  const params = new URLSearchParams();
  if (response.code) params.set("code", response.code);
  if (response.state) params.set("state", response.state);
  if (response.error) params.set("error", response.error);
  if (response.errorDescription) {
    params.set("error_description", response.errorDescription);
  }
  return createNativeOAuthCallbackUrl(provider, params);
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
