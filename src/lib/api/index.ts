import { createDevApi } from "./dev";
import { createRemoteApi } from "./remote";
import type { ApiContract } from "./types";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const remoteApi = createRemoteApi(baseUrl);
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
  return developerModeEnabled || hasStoredDeveloperMode()
    ? developerApi
    : remoteApi;
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
