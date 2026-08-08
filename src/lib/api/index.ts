import { isDevAccountEnabled } from "../dev-account";
import { createDevApi } from "./dev";
import { createRemoteApi } from "./remote";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * 백엔드 주소가 없는 임시 개발 환경에서는 같은 53개 계약의 인메모리 어댑터를,
 * 백엔드 주소가 있으면 원격 API 클라이언트를 사용합니다.
 */
export const api = isDevAccountEnabled()
  ? createDevApi()
  : createRemoteApi(baseUrl);

export { ApiError } from "./client";
export type * from "./types";
