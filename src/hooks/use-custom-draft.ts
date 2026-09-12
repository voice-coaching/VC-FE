"use client";

import { useEffect, useState } from "react";
import {
  CUSTOM_DRAFT_KEY,
  parseDraft,
  serializeDraft,
} from "@/lib/custom-draft";

export function useCustomDraft() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"empty" | "saved" | "error">("empty");
  useEffect(() => {
    try {
      setPending(parseDraft(sessionStorage.getItem(CUSTOM_DRAFT_KEY)));
    } catch {
      setStatus("error");
    }
    setReady(true);
  }, []);
  // Save in the input event, not a debounce: an immediate navigation cannot lose the last edit.
  const update = (value: string) => {
    setText(value);
    try {
      if (value.trim())
        sessionStorage.setItem(CUSTOM_DRAFT_KEY, serializeDraft(value));
      else sessionStorage.removeItem(CUSTOM_DRAFT_KEY);
      setStatus(value.trim() ? "saved" : "empty");
    } catch {
      setStatus("error");
    }
  };
  useEffect(() => {
    if (status !== "error" || !text.trim()) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status, text]);
  return {
    text,
    update,
    pending,
    ready,
    status,
    restore: () => {
      if (pending !== null) update(pending);
      setPending(null);
    },
    discard: () => {
      update("");
      setPending(null);
    },
  };
}
