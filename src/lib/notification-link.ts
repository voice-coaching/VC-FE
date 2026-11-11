/** Translate the stored API route alias, including old cached notifications. */
export function notificationHref(
  value: string | null | undefined,
): string | undefined {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return undefined;
  const url = new URL(value, "https://notification.invalid");
  if (url.origin !== "https://notification.invalid") return undefined;
  if (url.pathname === "/notifications" || url.pathname === "/notifications/")
    url.pathname = "/home/notifications";
  return url.pathname + url.search + url.hash;
}
