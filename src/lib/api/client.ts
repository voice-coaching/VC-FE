import type { ApiEnvelope } from "./types";
import { markAnonymousSession } from "../auth-session";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "API_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const ACCESS_TOKEN_STORAGE_KEY = "speakai.access-token";
let accessToken: string | null = null;
let sessionVersion = 0;
let nativeSessionRecoveryEnabled = false;
export function enableNativeSessionRecovery() {
  nativeSessionRecoveryEnabled = true;
}
const sessionListeners = new Set<() => void>();
function notifySessionChange() {
  sessionListeners.forEach((listener) => listener());
}
function onStoredTokenChange(event: StorageEvent) {
  if (event.key !== ACCESS_TOKEN_STORAGE_KEY && event.key !== null) return;
  accessToken = readStoredAccessToken();
  sessionVersion += 1;
  notifySessionChange();
}
/** Result readers must discard in-memory evidence on login/logout/user switches. */
export function subscribeAuthSession(listener: () => void) {
  if (sessionListeners.size === 0 && typeof window !== "undefined")
    window.addEventListener("storage", onStoredTokenChange);
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0 && typeof window !== "undefined")
      window.removeEventListener("storage", onStoredTokenChange);
  };
}

export function getAuthSessionVersion() {
  return sessionVersion;
}

function assertCurrentSession(version: number) {
  if (version !== sessionVersion) {
    throw new ApiError(
      "로그인 상태가 변경되었습니다. 다시 시도해 주세요.",
      409,
      "AUTH_SESSION_CHANGED",
    );
  }
}

function readStoredAccessToken() {
  if (typeof window === "undefined") return null;
  try {
    const storedToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    const normalized = storedToken
      ?.trim()
      .replace(/^Bearer\s+/i, "")
      .trim();
    return normalized || null;
  } catch {
    return null;
  }
}

function persistAccessToken(value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {}
}

export function saveAccessToken(value: string) {
  const token = storeAccessToken(value);
  sessionVersion += 1;
  notifySessionChange();
  return token;
}

// Renewing a token keeps the same session; login/logout starts a new one.
function storeAccessToken(value: string) {
  const normalized = value
    .trim()
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!normalized) {
    throw new ApiError(
      "로그인 응답에 Access Token이 없습니다.",
      500,
      "INVALID_AUTH_RESPONSE",
    );
  }
  accessToken = normalized;
  persistAccessToken(normalized);
  return normalized;
}

export function clearAccessToken() {
  sessionVersion += 1;
  accessToken = null;
  persistAccessToken(null);
  notifySessionChange();
}

export function getAccessToken() {
  if (!accessToken) accessToken = readStoredAccessToken();
  return accessToken;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
  skipAuth?: boolean;
  skipRefresh?: boolean;
  endpointErrorsOnly?: boolean;
  deferAuthFailure?: boolean;
  responseType?: "json" | "audio";
}

type HttpClientOptions = {
  native?: boolean;
  refreshRetryDelayMs?: number;
};

function joinUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createHttpClient(
  baseUrl: string,
  { native, refreshRetryDelayMs = 500 }: HttpClientOptions = {},
) {
  type RefreshResult = {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
  };
  let refreshFlight: {
    version: number;
    promise: Promise<RefreshResult>;
  } | null = null;

  async function refreshAccessToken() {
    const version = sessionVersion;
    if (!refreshFlight || refreshFlight.version !== version) {
      const recoverNativeSession = native ?? nativeSessionRecoveryEnabled;
      const requestRefresh = (deferAuthFailure: boolean) =>
        request<RefreshResult>("/api/auth/token/refresh", {
          method: "POST",
          skipAuth: true,
          skipRefresh: true,
          deferAuthFailure,
        });
      const promise = (async () => {
        try {
          return await requestRefresh(recoverNativeSession);
        } catch (reason) {
          const retryable =
            reason instanceof ApiError && [0, 401, 408].includes(reason.status);
          if (!recoverNativeSession || !retryable) throw reason;

          // A resumed WKWebView can briefly make its cookie jar or network
          // unavailable. Give it one short grace attempt before treating the
          // refresh session as expired and signing the user out.
          assertCurrentSession(version);
          await new Promise((resolve) =>
            setTimeout(resolve, refreshRetryDelayMs),
          );
          assertCurrentSession(version);
          return requestRefresh(false);
        }
      })()
        .then((data) => {
          assertCurrentSession(version);
          return { ...data, accessToken: storeAccessToken(data.accessToken) };
        })
        .finally(() => {
          if (refreshFlight?.promise === promise) refreshFlight = null;
        });
      refreshFlight = { version, promise };
    }
    return refreshFlight.promise;
  }

  async function request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const {
      body: rawBody,
      timeoutMs = 20_000,
      skipAuth = false,
      skipRefresh = false,
      endpointErrorsOnly = false,
      deferAuthFailure = false,
      responseType = "json",
      signal,
      ...fetchOptions
    } = options;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers(fetchOptions.headers);
    headers.set(
      "Accept",
      responseType === "audio" ? "audio/mpeg" : "application/json",
    );
    const token = getAccessToken();
    const version = sessionVersion;
    if (token && !skipAuth) headers.set("Authorization", `Bearer ${token}`);

    let body: BodyInit | undefined;
    if (rawBody instanceof FormData || rawBody instanceof Blob) {
      body = rawBody;
    } else if (rawBody !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(rawBody);
    }

    try {
      const response = await fetch(joinUrl(baseUrl, path), {
        ...fetchOptions,
        headers,
        body,
        signal: controller.signal,
        credentials: "include",
      });
      assertCurrentSession(version);

      if (response.status === 401 && !skipAuth && !skipRefresh) {
        clearTimeout(timeout);
        // Another request may already have renewed the expired token while
        // this response was in flight. Reuse it instead of rotating again.
        if (getAccessToken() === token) {
          try {
            await refreshAccessToken();
          } catch (error) {
            // Never confuse a refresh endpoint's 404 with a canonical-to-legacy signal.
            if (endpointErrorsOnly)
              throw new ApiError(
                "로그인 갱신에 실패했습니다.",
                error instanceof ApiError ? error.status : 401,
                "AUTH_REFRESH_FAILED",
              );
            throw error;
          }
        }
        assertCurrentSession(version);
        if (signal?.aborted)
          throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
        return request<T>(path, { ...options, skipRefresh: true });
      }

      if (responseType === "audio" && response.ok) {
        if (
          response.status !== 200 ||
          response.headers
            .get("content-type")
            ?.split(";")[0]
            .trim()
            .toLowerCase() !== "audio/mpeg" ||
          !response.body
        ) {
          await response.body?.cancel();
          throw new ApiError(
            "올바른 예시 음성을 받지 못했습니다.",
            502,
            "INVALID_AUDIO",
          );
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 2_000_000) {
              await reader.cancel();
              throw new ApiError(
                "예시 음성 크기가 제한을 초과했습니다.",
                502,
                "INVALID_AUDIO",
              );
            }
            chunks.push(new Uint8Array(value));
          }
        } finally {
          reader.releaseLock();
        }
        assertCurrentSession(version);
        if (!size)
          throw new ApiError(
            "예시 음성이 비어 있습니다.",
            502,
            "INVALID_AUDIO",
          );
        const headerToken = response.headers.get("x-new-access-token");
        if (headerToken && getAccessToken() === token)
          storeAccessToken(headerToken);
        return new Blob(chunks, { type: "audio/mpeg" }) as T;
      }
      if (response.status === 204) return undefined as T;

      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as ApiEnvelope<T>)
        : null;
      assertCurrentSession(version);

      if (!response.ok || !payload?.result) {
        if (
          response.status === 401 &&
          (!skipAuth || path === "/api/auth/token/refresh") &&
          !deferAuthFailure &&
          getAccessToken() === token
        ) {
          clearAccessToken();
          markAnonymousSession();
        }
        throw new ApiError(
          payload?.message ?? "요청을 처리하지 못했습니다.",
          response.status,
          payload?.code ?? response.headers.get("x-error-code") ?? "API_ERROR",
          payload?.data,
        );
      }

      const data = payload.data;
      if (data && typeof data === "object" && "newAccessToken" in data) {
        const newAccessToken = (data as { newAccessToken?: unknown })
          .newAccessToken;
        if (typeof newAccessToken === "string" && newAccessToken) {
          if (getAccessToken() === token) storeAccessToken(newAccessToken);
          const keys = Object.keys(data);
          if (keys.length === 1 && !skipRefresh) {
            clearTimeout(timeout);
            return request<T>(path, { ...options, skipRefresh: true });
          }
        }
      }

      const headerToken = response.headers.get("x-new-access-token");
      if (headerToken && getAccessToken() === token)
        storeAccessToken(headerToken);
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        if (signal?.aborted)
          throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
        throw new ApiError("요청 시간이 초과되었습니다.", 408, "TIMEOUT");
      }
      throw new ApiError(
        "네트워크 연결을 확인해 주세요.",
        0,
        "NETWORK_ERROR",
        error,
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

  function upload(
    url: string,
    audio: Blob,
    headers: Record<string, string>,
    onProgress?: (percent: number) => void,
    authorize = false,
  ) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      const version = sessionVersion;
      const token = getAccessToken();
      if (
        authorize &&
        token &&
        !Object.keys(headers).some(
          (key) => key.toLowerCase() === "authorization",
        )
      )
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      Object.entries(headers).forEach(([key, value]) =>
        xhr.setRequestHeader(key, value),
      );
      xhr.timeout = 60_000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (version !== sessionVersion) {
          reject(
            new ApiError(
              "로그인 상태가 변경되었습니다.",
              409,
              "AUTH_SESSION_CHANGED",
            ),
          );
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve();
        } else {
          const uploadAuthorizationFailed =
            xhr.status === 401 || xhr.status === 403;
          reject(
            new ApiError(
              uploadAuthorizationFailed
                ? "녹음 파일 업로드 승인이 만료되었거나 올바르지 않습니다."
                : "음성 파일 업로드에 실패했습니다.",
              xhr.status,
              uploadAuthorizationFailed
                ? "UPLOAD_AUTHORIZATION_FAILED"
                : "UPLOAD_FAILED",
            ),
          );
        }
      };
      xhr.onerror = () =>
        reject(
          new ApiError("음성 파일 업로드에 실패했습니다.", 0, "UPLOAD_FAILED"),
        );
      xhr.ontimeout = () =>
        reject(
          new ApiError(
            "음성 파일 업로드 시간이 초과되었습니다.",
            408,
            "UPLOAD_TIMEOUT",
          ),
        );
      xhr.send(audio);
    });
  }

  function requestAudio(
    path: string,
    options: Omit<RequestOptions, "responseType"> = {},
  ) {
    return request<Blob>(path, { ...options, responseType: "audio" });
  }
  return { request, requestAudio, upload, refreshAccessToken };
}
