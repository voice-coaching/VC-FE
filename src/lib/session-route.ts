/** Destination for an authenticated user, or null when the route is allowed. */
export function sessionRouteRedirect(
  pathname: string,
  onboardingCompleted: boolean,
  termsAccepted: boolean,
): "/home" | "/terms" | "/onboarding" | null {
  if (onboardingCompleted) {
    return pathname === "/terms" || pathname === "/onboarding" ? "/home" : null;
  }
  // The first onboarding step can go back to review consent choices.
  if (pathname === "/terms") return null;
  if (pathname === "/onboarding" && termsAccepted) return null;
  return termsAccepted ? "/onboarding" : "/terms";
}
