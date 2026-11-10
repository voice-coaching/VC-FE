import type { ApiEnvelope } from "./types";
import { markAnonymousSession } from "../auth-session";
import {
  captureApiErrorDiagnostics,
  parseDiagnosticResponse,
  type ApiErrorDiagnostics,
} from "./error-diagnostics";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "API_ERROR",
    public readonly details?: unknown,
    public readonly retryAfterMs?: number,
    public readonly upstreamStatus?: number,
    public diagnostics?: ApiErrorDiagnostics,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function retryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const ms = /^\d+$/.test(value)
    ? Number(value) * 1_000
    : Date.parse(value) - Date.now();
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

function browserManagedHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    /^(proxy-|sec-)/.test(lower) ||
    new Set([
      "accept-charset",
      "accept-encoding",
      "access-control-request-headers",
      "access-control-request-method",
      "connection",
      "content-length",
      "cookie",
      "cookie2",
      "date",
      "dnt",
      "expect",
      "host",
      "keep-alive",
      "origin",
      "referer",
      "set-cookie",
      "te",
      "trailer",
      "transfer-encoding",
      "upgrade",
      "via",
    ]).has(lower)
  );
}

const ACCESS_TOKEN_STORAGE_KEY = "speakai.access-token";
let accessToken: string | null = null;
let sessionVersion = 0;
let nativeSessionRecoveryEnabled = false;
type RefreshResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
};
// API, canonical result and script clients share the same browser login.
const refreshFlights = new Map<
  string,
  { version: number; promise: Promise<RefreshResult> }
>();
export function enableNativeSessionRecovery() {
  nativeSessionRecoveryEnabled = true;
}
const sessionListeners = new Set<() => void>();
function notifySessionChange() {
  sessionListeners.forEach((listener) => listener());
}
function onStoredTokenChange(event: StorageEvent) {
  if (event.key !== ACCESS_TOKEN_STORAGE_KEY && event.key !== null) return;
  reconcileStoredToken(readStoredAccessToken());
}

function reconcileStoredToken(next: string | null) {
  const previous = accessToken;
  if (previous === next) return;
  accessToken = next;
  // Claims identify a UI session only. Every API still authenticates the JWT.
  const previousIdentity = loginIdentity(previous);
  if (previousIdentity && previousIdentity === loginIdentity(next)) return;
  sessionVersion += 1;
  notifySessionChange();
}

function loginIdentity(token: string | null) {
  try {
    if (!token) return null;
    const claims = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (
      claims.type !== "access" ||
      ![claims.iss, claims.sub, claims.sid, claims.role].every(
        (value) => typeof value === "string" && value.length > 0,
      )
    )
      return null;
    return JSON.stringify([claims.iss, claims.sub, claims.sid, claims.role]);
  } catch {
    return null;
  }
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
  const token = storeAccessToken(value, false);
  sessionVersion += 1;
  notifySessionChange();
  return token;
}

// Renewal preserves UI state only while the account, login session and role match.
function storeAccessToken(value: string, detectIdentityChange = true) {
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
  const previousIdentity = loginIdentity(accessToken);
  const nextIdentity = loginIdentity(normalized);
  accessToken = normalized;
  persistAccessToken(normalized);
  // Renewal is the same UI session only while account, login session and role all match.
  if (
    detectIdentityChange &&
    previousIdentity &&
    nextIdentity &&
    previousIdentity !== nextIdentity
  ) {
    sessionVersion += 1;
    notifySessionChange();
  }
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

export function accessTokenNeedsRefresh(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(payload));
    if (!claims || typeof claims !== "object" || !("exp" in claims))
      return false;
    const expiresAt = claims.exp;
    return (
      typeof expiresAt === "number" &&
      Number.isFinite(expiresAt) &&
      expiresAt * 1_000 <= Date.now() + 10_000
    );
  } catch {
    // Opaque or malformed tokens still go through normal server authentication.
    return false;
  }
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
  const pendingReads = new Map<string, Promise<unknown>>();

  // Share only identical default JSON reads while they are in flight. Explicit
  // signals, headers, cache modes and timeouts keep their own request lifecycle.
  // No completed response is cached, so revisiting a screen still revalidates.
  function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = (options.method ?? "GET").toUpperCase();
    const shareRead =
      method === "GET" && Object.keys(options).every((key) => key === "method");
    if (!shareRead) {
      const changesData =
        !["GET", "HEAD", "OPTIONS"].includes(method) &&
        path !== "/api/auth/token/refresh";
      if (changesData) pendingReads.clear();
      return performRequest<T>(path, options).finally(() => {
        // Reads started during a mutation must also revalidate after it settles.
        if (changesData) pendingReads.clear();
      });
    }

    const key = `${sessionVersion}:${path}`;
    const existing = pendingReads.get(key);
    if (existing) return existing as Promise<T>;
    const pending = performRequest<T>(path, options).finally(() => {
      if (pendingReads.get(key) === pending) pendingReads.delete(key);
    });
    pendingReads.set(key, pending);
    return pending;
  }

  async function refreshAccessToken() {
    const version = sessionVersion;
    const recoverNativeSession = native ?? nativeSessionRecoveryEnabled;
    const key = baseUrl.replace(/\/$/, "");
    const refreshFlight = refreshFlights.get(key);
    if (!refreshFlight || refreshFlight.version !== version) {
      const tokenBeforeLock = getAccessToken();
      const storedBeforeLock = readStoredAccessToken();
      const requestRefresh = (deferAuthFailure: boolean) =>
        request<RefreshResult>("/api/auth/token/refresh", {
          method: "POST",
          skipAuth: true,
          skipRefresh: true,
          deferAuthFailure,
        });
      const rotate = async () => {
        assertCurrentSession(version);
        if (typeof window !== "undefined") {
          const stored = readStoredAccessToken();
          if (
            stored !== tokenBeforeLock &&
            (stored !== null || storedBeforeLock !== null)
          ) {
            reconcileStoredToken(stored);
            assertCurrentSession(version);
            if (
              stored &&
              loginIdentity(stored) &&
              !accessTokenNeedsRefresh(stored)
            ) {
              const claims = JSON.parse(
                atob(
                  stored.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
                ),
              );
              if (typeof claims.exp === "number" && Number.isFinite(claims.exp))
                return {
                  accessToken: stored,
                  tokenType: "Bearer",
                  expiresIn: Math.max(
                    0,
                    Math.floor(claims.exp - Date.now() / 1_000),
                  ),
                };
            }
          }
        }
        let data: RefreshResult;
        try {
          data = await requestRefresh(recoverNativeSession);
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
          data = await requestRefresh(false);
        }
        assertCurrentSession(version);
        // Persist before releasing the cross-tab lock, so its next holder can reuse it.
        return { ...data, accessToken: storeAccessToken(data.accessToken) };
      };
      const coordinated = async () => {
        if (
          typeof window === "undefined" ||
          typeof navigator === "undefined" ||
          !navigator.locks
        )
          return rotate();
        let started = false;
        try {
          return await navigator.locks.request(
            `speakai.refresh:${key}`,
            { signal: AbortSignal.timeout(45_000) },
            () => {
              started = true;
              return rotate();
            },
          );
        } catch (error) {
          // Some native WebViews expose locks without allowing their use.
          if (
            !started &&
            error instanceof DOMException &&
            [
              "SecurityError",
              "NotSupportedError",
              "InvalidStateError",
            ].includes(error.name)
          )
            return rotate();
          throw error;
        }
      };
      const promise = coordinated().finally(() => {
        if (refreshFlights.get(key)?.promise === promise)
          refreshFlights.delete(key);
      });
      refreshFlights.set(key, { version, promise });
      return promise;
    }
    return refreshFlight.promise;
  }

  async function performRequest<T>(
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
    let token = getAccessToken();
    const version = sessionVersion;
    if (token && !skipAuth) headers.set("Authorization", `Bearer ${token}`);

    let body: BodyInit | undefined;
    if (rawBody instanceof FormData || rawBody instanceof Blob) {
      body = rawBody;
    } else if (rawBody !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(rawBody);
    }

    let awaitingFetch = true;
    let refreshedBeforeRequest = false;
    try {
      const renew = async () => {
        try {
          await refreshAccessToken();
        } catch (error) {
          if (endpointErrorsOnly)
            throw new ApiError(
              "로그인 갱신에 실패했습니다.",
              error instanceof ApiError ? error.status : 401,
              "AUTH_REFRESH_FAILED",
              undefined,
              undefined,
              undefined,
              error instanceof ApiError ? error.diagnostics : undefined,
            );
          throw error;
        }
      };
      if (
        token &&
        !skipAuth &&
        !skipRefresh &&
        accessTokenNeedsRefresh(token)
      ) {
        if (signal?.aborted)
          throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
        // Renew before concurrent catalog requests send a known expired JWT.
        // Reading exp is a scheduling hint; only the server authenticates it.
        await renew();
        assertCurrentSession(version);
        if (signal?.aborted)
          throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
        refreshedBeforeRequest = true;
        token = getAccessToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);
      }
      const response = await fetch(joinUrl(baseUrl, path), {
        ...fetchOptions,
        headers,
        body,
        signal: controller.signal,
        credentials: "include",
      });
      awaitingFetch = false;
      assertCurrentSession(version);

      if (
        response.status === 401 &&
        !skipAuth &&
        !skipRefresh &&
        (!refreshedBeforeRequest || getAccessToken() !== token)
      ) {
        clearTimeout(timeout);
        // Another request may already have renewed the expired token while
        // this response was in flight. Reuse it instead of rotating again.
        if (getAccessToken() === token) {
          await renew();
        }
        assertCurrentSession(version);
        if (signal?.aborted)
          throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
        return performRequest<T>(path, { ...options, skipRefresh: true });
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
      let payload: ApiEnvelope<T> | null = null;
      let diagnosticResponse: unknown = null;
      if (contentType.includes("application/json")) {
        try {
          const text = await response.text();
          diagnosticResponse = text || null;
          payload = JSON.parse(text) as ApiEnvelope<T>;
          diagnosticResponse = payload;
        } catch (error) {
          if (controller.signal.aborted) throw error;
          if (response.ok)
            throw new ApiError(
              "서버 응답 형식이 올바르지 않습니다.",
              response.status,
              "RESPONSE_INVALID",
              undefined,
              undefined,
              undefined,
              captureApiErrorDiagnostics(
                fetchOptions.method ?? "GET",
                joinUrl(baseUrl, path),
                diagnosticResponse,
              ),
            );
        }
      } else if (!response.ok) {
        diagnosticResponse = await response.text();
      }
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
          retryAfter(response.headers.get("retry-after")),
          response.ok ? undefined : response.status,
          captureApiErrorDiagnostics(
            fetchOptions.method ?? "GET",
            joinUrl(baseUrl, path),
            diagnosticResponse,
          ),
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
            return performRequest<T>(path, { ...options, skipRefresh: true });
          }
        }
      }

      const headerToken = response.headers.get("x-new-access-token");
      if (headerToken && getAccessToken() === token)
        storeAccessToken(headerToken);
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        error.diagnostics ??= captureApiErrorDiagnostics(
          fetchOptions.method ?? "GET",
          joinUrl(baseUrl, path),
          null,
        );
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        if (signal?.aborted)
          throw new ApiError("요청을 취소했습니다.", 499, "REQUEST_ABORTED");
        throw new ApiError("요청 시간이 초과되었습니다.", 408, "TIMEOUT");
      }
      if (!(awaitingFetch && error instanceof TypeError))
        throw new ApiError(
          "서버 응답을 해석하지 못했습니다.",
          0,
          "RESPONSE_INVALID",
        );
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
    signal?: AbortSignal,
  ) {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("업로드를 취소했습니다.", "AbortError"));
        return;
      }
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
      Object.entries(headers).forEach(([key, value]) => {
        if (!browserManagedHeader(key)) xhr.setRequestHeader(key, value);
      });
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
              undefined,
              undefined,
              undefined,
              captureApiErrorDiagnostics(
                "PUT",
                url,
                parseDiagnosticResponse(xhr.responseText),
              ),
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
      const cancel = () => xhr.abort();
      xhr.onabort = () =>
        reject(new DOMException("업로드를 취소했습니다.", "AbortError"));
      xhr.onloadend = () => signal?.removeEventListener("abort", cancel);
      signal?.addEventListener("abort", cancel, { once: true });
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
