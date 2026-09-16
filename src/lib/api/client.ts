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
}

function joinUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createHttpClient(baseUrl: string) {
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
      const promise = request<RefreshResult>("/api/auth/token/refresh", {
        method: "POST",
        skipAuth: true,
        skipRefresh: true,
      })
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
      ...fetchOptions
    } = options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers(fetchOptions.headers);
    headers.set("Accept", "application/json");
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
        if (getAccessToken() === token) await refreshAccessToken();
        assertCurrentSession(version);
        return request<T>(path, { ...options, skipRefresh: true });
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
    }
  }

  function upload(
    url: string,
    audio: Blob,
    headers: Record<string, string>,
    onProgress?: (percent: number) => void,
  ) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      Object.entries(headers).forEach(([key, value]) =>
        xhr.setRequestHeader(key, value),
      );
      xhr.timeout = 60_000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve();
        } else {
          reject(
            new ApiError(
              "음성 파일 업로드에 실패했습니다.",
              xhr.status,
              "UPLOAD_FAILED",
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

  return { request, upload, refreshAccessToken };
}
