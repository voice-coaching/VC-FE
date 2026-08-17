import { isDevAccountEnabled } from "../dev-account";
import { createDevApi } from "./dev";
import { createRemoteApi } from "./remote";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const api = isDevAccountEnabled()
  ? createDevApi()
  : createRemoteApi(baseUrl);

export { ApiError } from "./client";
export type * from "./types";
