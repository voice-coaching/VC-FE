import { mockApi } from "./mock";
import { createRemoteApi } from "./remote";

const mode = process.env.VITE_API_MODE ?? "mock";
const baseUrl = process.env.VITE_API_BASE_URL ?? "/api";

/**
 * The UI only imports this contract. Set VITE_API_MODE=remote when the backend
 * implements the endpoints documented in docs/API_INTEGRATION.md.
 */
export const api = mode === "remote" ? createRemoteApi(baseUrl) : mockApi;
export const apiMode = mode;

export { ApiError } from "./client";
export type * from "./types";
