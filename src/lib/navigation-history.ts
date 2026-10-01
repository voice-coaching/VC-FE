const KEY = "__speakaiNavigation";
const installed = new WeakSet<object>();

type HistoryState = Record<string, unknown>;
type AppEntry = { depth: number };
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
    ? { depth: Number(entry.depth) }
    : null;
}

export function canNavigateBack(state: unknown): boolean {
  return (readEntry(state)?.depth ?? 0) > 0;
}

/** Track only same-document entries made after entering the app.
 * history.length alone also counts external sites and cannot safely decide back.
 * Preserve Next's router state; no extra entries are created by this tracker.
 */
export function installNavigationHistory(history: HistoryPort) {
  if (installed.has(history)) return;
  installed.add(history);
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  replace(
    {
      ...asState(history.state),
      [KEY]: readEntry(history.state) ?? { depth: 0 },
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
        [KEY]: { depth: (readEntry(history.state)?.depth ?? 0) + 1 },
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
      { ...asState(data), [KEY]: readEntry(history.state) ?? { depth: 0 } },
      unused,
      url,
    );
  };
}
