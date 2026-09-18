import { api, disableDeveloperApi, enableDeveloperApi } from "@/lib/api";
import { markAuthenticatedSession } from "@/lib/auth-session";

const DEVELOPER_ACCOUNT = {
  email: "dev@ttobak.local",
  password: "Dev1234!",
} as const;

export async function requestDeveloperSession() {
  enableDeveloperApi();
  try {
    const session = await api.auth.signIn(DEVELOPER_ACCOUNT);
    markAuthenticatedSession(session);
    return session;
  } catch (reason) {
    disableDeveloperApi();
    throw reason;
  }
}
