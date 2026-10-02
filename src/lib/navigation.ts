export function safeInternalPath(
  value: string | null | undefined,
  fallback: string,
) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
export const NAVIGATION_REQUEST_EVENT = "speakai:navigation-request";

export function requestNavigation(action: () => void) {
  const event = new CustomEvent(NAVIGATION_REQUEST_EVENT, {
    cancelable: true,
    detail: action,
  });
  if (window.dispatchEvent(event)) action();
}
