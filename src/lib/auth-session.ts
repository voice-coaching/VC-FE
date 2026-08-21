import type { AuthSession, Id, UserAccount } from "./api/types";

export type AuthSessionSnapshot =
  | { status: "unknown" }
  | { status: "anonymous" }
  | {
      status: "authenticated";
      userId?: Id;
      onboardingCompleted: boolean;
    };

let snapshot: AuthSessionSnapshot = { status: "unknown" };
let cachedUser: UserAccount | null = null;

export function getAuthSessionSnapshot() {
  return snapshot;
}

export function getCachedUser() {
  return cachedUser;
}

export function markAuthenticatedSession(session: AuthSession) {
  cachedUser = null;
  snapshot = {
    status: "authenticated",
    userId: session.user.id,
    onboardingCompleted: !session.onboardingRequired,
  };
}

export function markAuthenticatedUser(user: UserAccount) {
  cachedUser = user;
  snapshot = {
    status: "authenticated",
    userId: user.id,
    onboardingCompleted: user.onboardingCompleted,
  };
}

export function markOnboardingCompleted() {
  if (snapshot.status !== "authenticated") return;
  snapshot = { ...snapshot, onboardingCompleted: true };
}

export function markAnonymousSession() {
  cachedUser = null;
  snapshot = { status: "anonymous" };
}

export function resetAuthSession() {
  cachedUser = null;
  snapshot = { status: "unknown" };
}
