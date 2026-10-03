"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Difficulty } from "@/lib/api";
import {
  installNavigationHistory,
  navigationEntryId,
} from "@/lib/navigation-history";

type Filters = { category: string; difficulty: Difficulty | "" };
const defaults: Filters = { category: "", difficulty: "" };
const entries = new Map<string, Filters>();

function entryKey(scope: string) {
  const id =
    typeof window === "undefined"
      ? null
      : navigationEntryId(window.history.state);
  return id ? `${scope}:${id}` : null;
}

/** Keep selections for this visit, not for a new visit to the same URL. */
export function useCatalogFilters(scope: string) {
  const key = useRef<string | null>(null);
  const [state, setState] = useState(() => ({
    scope,
    value: entries.get(entryKey(scope) ?? "") ?? defaults,
  }));
  useLayoutEffect(() => {
    installNavigationHistory(window.history);
    key.current = entryKey(scope);
    setState({ scope, value: entries.get(key.current ?? "") ?? defaults });
  }, [scope]);

  const value = state.scope === scope ? state.value : defaults;
  function update(patch: Partial<Filters>) {
    const next = { ...value, ...patch };
    if (key.current) {
      entries.delete(key.current);
      entries.set(key.current, next);
      if (entries.size > 100) entries.delete(entries.keys().next().value!);
    }
    setState({ scope, value: next });
  }
  return {
    ...value,
    setCategory: (category: string) => update({ category }),
    setDifficulty: (difficulty: Difficulty | "") => update({ difficulty }),
  };
}
