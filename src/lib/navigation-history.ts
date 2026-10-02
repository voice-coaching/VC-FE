const KEY = "__speakaiNavigation";
const installed = new WeakSet<object>();

type HistoryState = Record<string, unknown>;
type AppEntry = { depth: number; id?: string; previousPath?: string };
type HistoryPort = Pick<History, "state" | "pushState" | "replaceState">;

function asState(value: unknown): HistoryState {
  return value !== null && typeof value === "object"
    ? (value as HistoryState)
    : {};
}

function readEntry(value: unknown): AppEntry | null {
  const entry = asState(value)[KEY];
  if (!entry || typeof entry !== "object" || !("depth" in entry)) return null;
  return Number.isSafeInteger(entry.depth) && Number(entry.depth) >= 0
    ? {
        depth: Number(entry.depth),
        ...("id" in entry && typeof entry.id === "string"
          ? { id: entry.id }
          : {}),
        ...("previousPath" in entry &&
        typeof entry.previousPath === "string" &&
        entry.previousPath.startsWith("/") &&
        !entry.previousPath.startsWith("//")
          ? { previousPath: entry.previousPath }
          : {}),
      }
    : null;
}

export function canNavigateBack(state: unknown): boolean {
  return (readEntry(state)?.depth ?? 0) > 0;
}

export function navigationEntryId(state: unknown): string | null {
  return readEntry(state)?.id ?? null;
}

export function previousNavigationPath(state: unknown): string | null {
  return canNavigateBack(state)
    ? (readEntry(state)?.previousPath ?? null)
    : null;
}

function currentEntry(state: unknown): AppEntry {
  const entry = readEntry(state) ?? { depth: 0 };
  return { ...entry, id: entry.id ?? crypto.randomUUID() };
}

/** Track only same-document entries made after entering the app.
 * history.length alone also counts external sites and cannot safely decide back.
 * Preserve Next's router state; no extra entries are created by this tracker.
 */
export function installNavigationHistory(
  history: HistoryPort,
  getPath: () => string | null = () =>
    typeof window === "undefined" ? null : window.location.pathname,
) {
  if (installed.has(history)) return;
  installed.add(history);
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  replace(
    {
      ...asState(history.state),
      [KEY]: currentEntry(history.state),
    },
    "",
  );

  history.pushState = (
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) => {
    push(
      {
        ...asState(data),
        [KEY]: {
          depth: (readEntry(history.state)?.depth ?? 0) + 1,
          id: crypto.randomUUID(),
          previousPath: getPath(),
        },
      },
      unused,
      url,
    );
  };
  history.replaceState = (
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) => {
    replace(
      { ...asState(data), [KEY]: currentEntry(history.state) },
      unused,
      url,
    );
  };
}
