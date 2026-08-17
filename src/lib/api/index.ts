import { mockApi } from "./mock";
import { createRemoteApi } from "./remote";

const mode = process.env.VITE_API_MODE ?? "mock";
const baseUrl = process.env.VITE_API_BASE_URL ?? "/api";

/**
<<<<<<< Updated upstream
 * The UI only imports this contract. Set VITE_API_MODE=remote when the backend
 * implements the endpoints documented in docs/API_INTEGRATION.md.
=======
 * 백엔드 주소가 없는 임시 개발 환경에서는 같은 52개 계약의 인메모리 어댑터를,
 * 백엔드 주소가 있으면 원격 API 클라이언트를 사용합니다.
>>>>>>> Stashed changes
 */
export const api = mode === "remote" ? createRemoteApi(baseUrl) : mockApi;
export const apiMode = mode;

export { ApiError } from "./client";
export type * from "./types";
