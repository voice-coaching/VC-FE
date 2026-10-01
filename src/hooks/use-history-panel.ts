"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { dialogNavigation } from "@/lib/dialog-navigation";
import { installNavigationHistory } from "@/lib/navigation-history";

export function useHistoryPanel<T extends string>(
  parameter: string,
  values: readonly T[],
) {
  const params = useSearchParams();
  const selected = params.get(parameter);
  const value = values.find((candidate) => candidate === selected) ?? null;
  const closing = useRef(false);

  useEffect(() => {
    closing.current = false;
  }, [params]);

  function setValue(next: T | null) {
    if (closing.current) return;
    installNavigationHistory(window.history);
    const action = dialogNavigation(
      window.location.href,
      window.history.state,
      parameter,
      next,
    );
    if (action.type === "back") {
      closing.current = true;
      window.history.back();
    } else if (action.type === "push") {
      // Let Next copy its router metadata; passing __NA back into pushState
      // would bypass Next's useSearchParams synchronization.
      window.history.pushState(action.state, "", action.url);
    } else if (action.type === "replace") {
      window.history.replaceState(action.state, "", action.url);
    }
  }

  return [value, setValue] as const;
}
