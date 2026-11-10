/** Unverified claims may reject admission early, but can never approve administrator access. */
export function tokenDisallowsAdmin(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const claims = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return claims.type === "access" && claims.role === "USER";
  } catch {
    return false; // Unknown tokens still require authoritative server validation.
  }
}
