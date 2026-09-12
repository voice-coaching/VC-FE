import type { AuthSession, Id } from "@/lib/api";

const TERMS_ACCEPTED_PREFIX = "ttobak.terms.accepted.";

export type SignupDraft = {
  email: string;
  password: string;
  nickname: string;
};

export type TermsPreferences = {
  qualityImprovement: boolean;
  marketing: boolean;
};

function canUseStorage() {
  return typeof window !== "undefined";
}

function acceptedKey(userId: Id) {
  return `${TERMS_ACCEPTED_PREFIX}${String(userId)}`;
}

export function hasAcceptedTerms(userId?: Id) {
  if (!canUseStorage() || userId === undefined) return false;
  return window.localStorage.getItem(acceptedKey(userId)) !== null;
}

export function markTermsAccepted(userId: Id, preferences: TermsPreferences) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    acceptedKey(userId),
    JSON.stringify({ acceptedAt: new Date().toISOString(), ...preferences }),
  );
}

export function getPostLoginDestination(
  session: AuthSession,
  completedDestination = "/home",
) {
  if (session.isNewUser) return "/terms";
  if (!session.onboardingRequired) return completedDestination;
  return hasAcceptedTerms(session.user.id) ? "/onboarding" : "/terms";
}
