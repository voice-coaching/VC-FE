import type { ApiEnvelope } from "./types";

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

let accessToken: string | null = null;

export function saveAccessToken(value: string) {
  accessToken = value;
}

export function clearAccessToken() {
  accessToken = null;
}

export function getAccessToken() {
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
  let refreshPromise: Promise<string> | null = null;

  async function refreshAccessToken() {
    if (!refreshPromise) {
      refreshPromise = request<{ accessToken: string }>(
        "/api/auth/token/refresh",
        {
          method: "POST",
          skipAuth: true,
          skipRefresh: true,
        },
      )
        .then(({ accessToken }) => {
          saveAccessToken(accessToken);
          return accessToken;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
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

      if (response.status === 401 && !skipAuth && !skipRefresh) {
        clearTimeout(timeout);
        await refreshAccessToken();
        return request<T>(path, { ...options, skipRefresh: true });
      }

      if (response.status === 204) return undefined as T;

      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as ApiEnvelope<T>)
        : null;

      if (!response.ok || !payload?.result) {
        if (response.status === 401) clearAccessToken();
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
          saveAccessToken(newAccessToken);
          const keys = Object.keys(data);
          if (keys.length === 1 && !skipRefresh) {
            clearTimeout(timeout);
            return request<T>(path, { ...options, skipRefresh: true });
          }
        }
      }

      const headerToken = response.headers.get("x-new-access-token");
      if (headerToken) saveAccessToken(headerToken.replace(/^Bearer\s+/i, ""));
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

  return { request, upload };
}
