/** Match capability MIME ranges without changing the recording's encoding. */
export function acceptsMediaMimeType(
  mimeType: string,
  acceptedMimeTypes: readonly string[],
): boolean {
  const normalize = (value: string) =>
    value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const source = normalize(mimeType);
  const parts = source.split("/");
  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1] ||
    source.includes("*")
  ) {
    return false;
  }
  return acceptedMimeTypes.some((value) => {
    const accepted = normalize(value);
    return (
      accepted === source ||
      accepted === `${parts[0]}/*` ||
      accepted === "*/*"
    );
  });
}
