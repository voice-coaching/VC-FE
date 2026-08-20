export function safeInternalPath(
  value: string | null | undefined,
  fallback: string,
) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
