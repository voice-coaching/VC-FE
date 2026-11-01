export type ApiErrorDiagnostics = {
  request: { method: string; path: string };
  response: unknown;
};

function safePath(value: string) {
  try {
    const url = new URL(value, "https://diagnostic.invalid");
    return url.pathname;
  } catch {
    return value.split(/[?#]/)[0];
  }
}

function redactText(value: string) {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED]",
    )
    .replace(/https?:\/\/[^\s"'<>]+/g, (value) => {
      try {
        const url = new URL(value);
        return `${url.origin}${url.pathname}${url.search ? "?[REDACTED]" : ""}`;
      } catch {
        return "[REDACTED URL]";
      }
    })
    .slice(0, 16_000);
}

function redactResponse(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => redactResponse(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          /token|password|secret|authorization|cookie|signature|credential|grant|uploadurl|playbackurl/i.test(
            key.replace(/[^a-z]/gi, ""),
          )
            ? "[REDACTED]"
            : redactResponse(item, depth + 1),
        ]),
    );
  return value;
}

/** Temporary in-memory diagnostics: never retain headers, request bodies or signed queries. */
export function captureApiErrorDiagnostics(
  method: string,
  path: string,
  response: unknown,
): ApiErrorDiagnostics {
  return {
    request: { method: method.toUpperCase(), path: safePath(path) },
    response: redactResponse(response),
  };
}

export function parseDiagnosticResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text || null;
  }
}
