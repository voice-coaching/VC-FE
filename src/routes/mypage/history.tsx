"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { scoreColor } from "@/lib/app-data";
import { api, type ContentType, type TrainingHistoryItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ value?: ContentType; label: string }> = [
  { label: "전체" },
  { value: "NEWS", label: "뉴스" },
  { value: "SENTENCE", label: "문장" },
  { value: "ANNOUNCER", label: "따라 읽기" },
  { value: "CLASS_PRACTICE", label: "클래스" },
];

export default function LearningHistory() {
  const [kind, setKind] = useState<ContentType | undefined>();
  const [items, setItems] = useState<TrainingHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setLoadMoreError(null);
    api.myPage
      .listTrainingSessions({
        type: kind,
        status: "COMPLETED",
        page: 0,
        size: 20,
      })
      .then((value) => {
        if (active) {
          setItems(value.items);
          setPage(value.page);
          setHasNext(Boolean(value.hasNext));
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "기록을 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind]);

  async function loadMore() {
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const value = await api.myPage.listTrainingSessions({
        type: kind,
        status: "COMPLETED",
        page: page + 1,
        size: 20,
      });
      setItems((current) => [...current, ...value.items]);
      setPage(value.page);
      setHasNext(Boolean(value.hasNext));
    } catch (reason) {
      setLoadMoreError(
        reason instanceof Error
          ? reason.message
          : "기록을 더 불러오지 못했습니다.",
      );
    } finally {
      setLoadingMore(false);
    }
  }
  return (
    <AppShell nav={false}>
      <TopBar to="/mypage" title="학습 기록" />
      <div className="px-5 pb-10">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              onClick={() => setKind(filter.value)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-semibold",
                kind === filter.value
                  ? "bg-foreground text-background"
                  : "bg-surface",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            기록을 불러오는 중…
          </p>
        ) : error ? (
          <p
            role="alert"
            className="py-12 text-center text-sm text-destructive"
          >
            {error}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <Link
                key={String(item.sessionId)}
                href={`/mypage/history/${item.sessionId}`}
                className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(item.completedAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <b className={scoreColor(item.overallScore)}>
                  {Math.round(item.overallScore)}
                </b>
              </Link>
            ))}
            {items.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                아직 저장된 학습 기록이 없습니다.
              </p>
            )}
            {hasNext && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="mt-3 w-full rounded-full border border-border py-3 text-sm font-semibold disabled:opacity-50"
              >
                {loadingMore ? "불러오는 중…" : "기록 더 보기"}
              </button>
            )}
            {loadMoreError && (
              <p role="alert" className="text-center text-xs text-destructive">
                {loadMoreError}
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
