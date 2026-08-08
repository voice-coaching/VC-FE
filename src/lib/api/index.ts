import { createRemoteApi } from "./remote";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** API 명세서(ver.08/07)의 53개 엔드포인트를 구현한 원격 API 클라이언트입니다. */
export const api = createRemoteApi(baseUrl);

export { ApiError } from "./client";
export type * from "./types";
