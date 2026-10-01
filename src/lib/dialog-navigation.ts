const KEY = "__speakaiDialog";

type DialogEntry = { parameter: string; value: string; closeTo: string };

function relativeUrl(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Keep presentation state in the URL, but never put form contents in history. */
export function dialogNavigation(
  href: string,
  state: unknown,
  parameter: string,
  next: string | null,
) {
  const url = new URL(href);
  const current = url.searchParams.get(parameter);
  if (current === next) return { type: "none" } as const;
  url.searchParams.delete(parameter);
  const closeTo = relativeUrl(url);
  const entry =
    state && typeof state === "object" && KEY in state
      ? ((state as Record<string, unknown>)[KEY] as DialogEntry | null)
      : null;
  const owned =
    entry?.parameter === parameter &&
    entry.value === current &&
    entry.closeTo === closeTo;

  if (next === null) {
    return owned
      ? ({ type: "back" } as const)
      : ({ type: "replace", url: closeTo, state: null } as const);
  }

  url.searchParams.set(parameter, next);
  return {
    type: current === null ? "push" : "replace",
    url: relativeUrl(url),
    state:
      current === null || owned
        ? { [KEY]: { parameter, value: next, closeTo } }
        : null,
  } as const;
}
