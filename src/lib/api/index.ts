import { createDevApi } from "./dev";
import { createRemoteApi } from "./remote";
import type { ApiContract } from "./types";

// Keep browser and native requests on the frontend origin. The server route
// forwards them to the configured backend and turns the HttpOnly refresh
// cookie into a first-party cookie, which is reliable inside iOS WKWebView.
const remoteApi = createRemoteApi("/api/backend");
const DEVELOPER_MODE_KEY = "ttobak.developer-mode";
let developerModeEnabled = false;

function hasStoredDeveloperMode() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEVELOPER_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

function activeApi() {
  return isDeveloperApiEnabled() ? developerApi : remoteApi;
}

export function isDeveloperApiEnabled() {
  return developerModeEnabled || hasStoredDeveloperMode();
}

export function enableDeveloperApi() {
  developerModeEnabled = true;
  try {
    window.localStorage.setItem(DEVELOPER_MODE_KEY, "true");
  } catch {}
}

export function disableDeveloperApi() {
  developerModeEnabled = false;
  try {
    window.localStorage.removeItem(DEVELOPER_MODE_KEY);
  } catch {}
}

const developerApi = createDevApi(disableDeveloperApi);

export const api = new Proxy(remoteApi, {
  get(_target, property: keyof ApiContract) {
    return activeApi()[property];
  },
}) as ApiContract;

export { ApiError } from "./client";
export type * from "./types";
