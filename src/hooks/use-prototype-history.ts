"use client";
import { useEffect, useRef, useState } from "react";
import {
  addCompletion,
  HISTORY_EVENT,
  HISTORY_KEY,
  parseHistory,
  type PracticeCompletion,
} from "@/lib/prototype-history";

export function useSavePracticeCompletion() {
  const ids = useRef(new Map<string, string>());
  return (
    item: Omit<PracticeCompletion, "id" | "completedAt">,
    key = "session",
  ) => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      const id = ids.current.get(key) ?? crypto.randomUUID();
      ids.current.set(key, id);
      const items = parseHistory(localStorage.getItem(HISTORY_KEY));
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(
          addCompletion(items, {
            ...item,
            id,
            completedAt: new Date().toISOString(),
          }),
        ),
      );
      window.dispatchEvent(new Event(HISTORY_EVENT));
    } catch {
      window.alert(
        "이 브라우저에 완료 기록을 저장하지 못했어요. 이번 연습 기록은 남지 않습니다.",
      );
    }
  };
}
export function usePrototypeHistory() {
  const [items, setItems] = useState<PracticeCompletion[]>([]);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const read = () => {
      try {
        setItems(parseHistory(localStorage.getItem(HISTORY_KEY)));
        setError(false);
      } catch {
        setError(true);
      }
      setReady(true);
    };
    read();
    window.addEventListener(HISTORY_EVENT, read);
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener(HISTORY_EVENT, read);
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
    };
  }, []);
  const clear = () => {
    try {
      localStorage.removeItem(HISTORY_KEY);
      setItems([]);
      setError(false);
      window.dispatchEvent(new Event(HISTORY_EVENT));
    } catch {
      setError(true);
    }
  };
  return { items, error, ready, clear };
}
