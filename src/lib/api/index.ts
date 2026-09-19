import { clearAccessToken, getAccessToken } from "./client";
import { createRemoteApi } from "./remote";
import { markAnonymousSession } from "../auth-session";

// Catalog, examples, recordings and results share one authenticated DB API.
// A browser flag must never replace server content IDs with mock records.
export const api = createRemoteApi("/api/backend");

export function disableDeveloperApi() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("ttobak.developer-mode");
  } catch {}
  if (getAccessToken() === "ttobak-local-development-token") {
    clearAccessToken();
    markAnonymousSession();
  }
}

// Migrate only the old local token; preserve real authenticated sessions.
disableDeveloperApi();

export { ApiError } from "./client";
export type * from "./types";
