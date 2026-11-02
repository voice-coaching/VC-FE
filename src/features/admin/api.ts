import { z } from "zod";
import {
  ApiError,
  createHttpClient,
  getAuthSessionVersion,
} from "@/lib/api/client";
import type { AdminAccess, Query } from "./types";

const client = createHttpClient("/api/backend");
const accessSchema = z.object({
  id: z.number().int().positive(),
  nickname: z.string(),
  role: z.literal("ADMIN"),
});
const accessListeners = new Set<(error: ApiError) => void>();
export function subscribeAdminDenial(listener: (error: ApiError) => void) {
  accessListeners.add(listener);
  return () => {
    accessListeners.delete(listener);
  };
}
export function queryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  return params.size ? `?${params.toString()}` : "";
}
/** All admin reads use the existing login/refresh/proxy, with HTTP no-store; short-lived UI state is managed by the query policy. */
async function request<T>(
  path: string,
  options: Parameters<typeof client.request>[1] = {},
): Promise<T> {
  const session = getAuthSessionVersion();
  try {
    return await client.request<T>(`/api/admin${path}`, {
      ...options,
      cache: "no-store",
    });
  } catch (error) {
    if (
      getAuthSessionVersion() === session &&
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    )
      accessListeners.forEach((listener) => listener(error));
    throw error;
  }
}
export const adminApi = {
  async access(signal?: AbortSignal): Promise<AdminAccess> {
    return accessSchema.parse(await request("/me", { signal }));
  },
  read<T>(path: string, query: Query = {}, signal?: AbortSignal): Promise<T> {
    return request<T>(path + queryString(query), { signal });
  },
  create<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body, timeoutMs: 120_000 });
  },
  remove<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "DELETE", body, timeoutMs: 120_000 });
  },
  edit<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "PATCH", body, timeoutMs: 120_000 });
  },
};
export function adminErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues
      .map((issue) =>
        /[가-힣]/.test(issue.message)
          ? issue.message
          : "입력한 값을 확인해 주세요.",
      )
      .join(" · ");
  if (error instanceof ApiError) {
    if (error.code === "ADMIN_SELF_DELETION_NOT_ALLOWED")
      return "현재 로그인한 관리자 본인의 계정은 여기서 삭제할 수 없습니다.";
    if (error.status === 409)
      return "다른 관리자가 수정했거나 상태가 변경되었습니다. 최신 상세를 다시 확인해 주세요. 입력한 내용은 자동으로 덮어쓰지 않습니다.";
    if (error.status === 404)
      return "대상을 찾을 수 없습니다. 관리자 API 배포 여부와 선택한 항목을 확인해 주세요.";
    if (error.status === 0 || error.status === 408 || error.status === 504)
      return "서버의 처리 결과를 확인하지 못했습니다. 같은 요청을 새로 만들기 전에 목록·상세에서 반영 여부를 확인해 주세요.";
  }
  return error instanceof Error && /[가-힣]/.test(error.message)
    ? error.message
    : "요청을 처리하지 못했습니다. 잠시 후 다시 확인해 주세요.";
}
