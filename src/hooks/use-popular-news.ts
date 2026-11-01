"use client";

import { useEffect, useState } from "react";
import { api, type PopularNews } from "@/lib/api";
import { getAuthSessionVersion } from "@/lib/api/client";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { readUserClientCache, writeUserClientCache } from "@/lib/client-cache";
import { popularNewsPayload } from "@/lib/popular-news";

const RESOURCE = "popular-news-daily-v1";
function cachedNews(userId: string | null) {
  try {
    return popularNewsPayload(readUserClientCache(userId, RESOURCE));
  } catch {
    return null;
  }
}

export function usePopularNews() {
  const userId = getAuthenticatedUserId();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    userId: string | null;
    data: PopularNews | null;
    loading: boolean;
    error: string | null;
  }>(() => ({ userId, data: cachedNews(userId), loading: true, error: null }));
  useEffect(() => {
    let active = true;
    const epoch = getAuthSessionVersion();
    setState({ userId, data: cachedNews(userId), loading: true, error: null });
    api.content
      .getPopularNews(10)
      .then(popularNewsPayload)
      .then((data) => {
        if (!active || epoch !== getAuthSessionVersion()) return;
        writeUserClientCache(userId, RESOURCE, data);
        setState({ userId, data, loading: false, error: null });
      })
      .catch((reason: unknown) => {
        if (active && epoch === getAuthSessionVersion())
          setState((current) => ({
            ...current,
            loading: false,
            error:
              reason instanceof Error
                ? reason.message
                : "인기 뉴스를 불러오지 못했어요.",
          }));
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);
  const data = state.userId === userId ? state.data : null;
  const nextUpdateAt = data?.nextUpdateAt;
  useEffect(() => {
    if (!nextUpdateAt) return;
    const deadline = Date.parse(nextUpdateAt);
    const timer = window.setTimeout(
      () => setAttempt((value) => value + 1),
      Math.max(1000, deadline - Date.now()),
    );
    const wake = () => {
      if (!document.hidden && Date.now() >= deadline)
        setAttempt((value) => value + 1);
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [nextUpdateAt, userId]);
  return {
    data,
    loading: state.userId !== userId || state.loading,
    error: state.userId === userId ? state.error : null,
    retry: () => setAttempt((value) => value + 1),
  };
}
