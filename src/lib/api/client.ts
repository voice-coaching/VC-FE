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

const ACCESS_TOKEN_KEY = "ttobak.accessToken";
const REFRESH_TOKEN_KEY = "ttobak.refreshToken";

export function saveTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRefreshToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
  skipAuth?: boolean;
}

export function createHttpClient(baseUrl: string) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
    const headers = new Headers(options.headers);
    const token =
      typeof window === "undefined" ? null : window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token && !options.skipAuth) headers.set("Authorization", `Bearer ${token}`);

    let body: BodyInit | undefined;
    if (options.body instanceof FormData || options.body instanceof Blob) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        body,
        signal: controller.signal,
        credentials: "include",
      });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      if (!response.ok) {
        const problem = payload as { message?: string; code?: string; details?: unknown };
        throw new ApiError(
          problem?.message ?? "요청을 처리하지 못했습니다.",
          response.status,
          problem?.code,
          problem?.details,
        );
      }
      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("요청 시간이 초과되었습니다.", 408, "TIMEOUT");
      }
      throw new ApiError("네트워크 연결을 확인해 주세요.", 0, "NETWORK_ERROR", error);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { request };
}
