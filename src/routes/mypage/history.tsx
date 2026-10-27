"use client";

import { DirectHistory } from "@/components/direct-history";

import { SkeletonBlock } from "@/components/skeleton-block";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  api,
  type ContentType,
  type PracticeContent,
  type TrainingHistoryItem,
} from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { readUserClientCache, writeUserClientCache } from "@/lib/client-cache";

import { cacheResources } from "@/lib/cache-resources";
import { cn } from "@/lib/utils";
import { useHistoryScroll } from "@/hooks/use-history-scroll";
import { installNavigationHistory } from "@/lib/navigation-history";
import { mergeHistoryItems, refreshHistoryWindow } from "@/lib/history-pages";
import { historyCacheResource, type HistoryCache } from "@/lib/history-cache";

const FILTERS: Array<{ value?: ContentType | "CUSTOM"; label: string }> = [
  { label: "전체" },
  { value: "NEWS", label: "뉴스" },
  { value: "SENTENCE", label: "문장" },
  { value: "ANNOUNCER", label: "아나운서" },
  { value: "CUSTOM", label: "내 문장" },
  { value: "CLASS_PRACTICE", label: "클래스" },
];

const TYPE_LABEL: Record<ContentType, string> = {
  NEWS: "뉴스",
  SENTENCE: "문장",
  ANNOUNCER: "아나운서",
  CLASS_PRACTICE: "클래스",
};

function localStartOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function relativeDateLabel(value: string, now = new Date()) {
  const date = new Date(value);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days > 1 && target >= localStartOfWeek(now)) return `${days}일 전`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function LearningHistory() {
  const params = useSearchParams();
  const filterValue = FILTERS.find(
    (filter) => filter.value === params.get("type"),
  )?.value;
  const kind = filterValue === "CUSTOM" ? "SENTENCE" : filterValue;
  const [origins, setOrigins] = useState<
    Record<string, "custom" | "catalog" | "error">
  >({});
  const userId = getAuthenticatedUserId();
  const [initialHistory] = useState(() =>
    readUserClientCache<HistoryCache>(userId, historyCacheResource(kind)),
  );
  const [items, setItems] = useState<TrainingHistoryItem[]>(
    initialHistory?.items ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialHistory === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(initialHistory?.page ?? 0);
  const [hasNext, setHasNext] = useState(initialHistory?.hasNext ?? false);
  const [retry, setRetry] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const generation = useRef(0);
  const moreBusy = useRef(false);
  const scope = `history:${userId}:${kind ?? "all"}`;
  const [loadedScope, setLoadedScope] = useState(scope);
  const loadingList = loading || loadedScope !== scope;
  const scrollReady = userId !== null && !loadingList;
  const mainScroll = useHistoryScroll(`${scope}:outer`, scrollReady);
  const listScroll = useHistoryScroll(`${scope}:inner`, scrollReady);

  function setKind(next?: ContentType | "CUSTOM") {
    if (next === filterValue) return;
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("type", next);
    else url.searchParams.delete("type");
    installNavigationHistory(window.history);
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  useEffect(() => {
    let active = true;
    generation.current += 1;
    moreBusy.current = false;
    setLoadingMore(false);
    setRefreshing(true);
    setLoadedScope(scope);
    const resource = historyCacheResource(kind);
    const cached = readUserClientCache<HistoryCache>(userId, resource);
    if (cached) {
      setItems(cached.items);
      setPage(cached.page);
      setHasNext(cached.hasNext);
      setLoading(false);
    } else {
      setItems([]);
      setPage(0);
      setHasNext(false);
      setLoading(true);
    }
    setError(null);
    setLoadMoreError(null);
    // Revalidate the entire loaded window, not just page zero. Otherwise a
    // detail round-trip removes later pages and clamps the restored scroll.
    const lastPage = cached?.page ?? 0;
    void refreshHistoryWindow(
      (page) =>
        api.myPage.listTrainingSessions({
          type: kind,
          status: "COMPLETED",
          page,
          size: 20,
        }),
      lastPage,
      () => active,
    )
      .then((value) => {
        if (!active || !value) return;
        setItems(value.items);
        setPage(value.page);
        setHasNext(Boolean(value.hasNext));
        writeUserClientCache<HistoryCache>(userId, resource, {
          items: value.items,
          page: value.page,
          hasNext: Boolean(value.hasNext),
        });
      })
      .catch((reason) => {
        if (active && !cached) {
          setError(
            reason instanceof Error
              ? reason.message
              : "기록을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [kind, userId, retry, scope]);

  useEffect(() => {
    let active = true;
    const candidates = [
      ...new Map(
        items
          .filter((item) => item.contentType === "SENTENCE")
          .map((item) => [String(item.contentId), item]),
      ).values(),
    ];
    void Promise.all(
      candidates.map(async (item) => {
        const resource = cacheResources.practiceContent(item.contentId);
        try {
          const content =
            readUserClientCache<PracticeContent>(userId, resource) ??
            (await api.content.get(item.contentId));
          writeUserClientCache(userId, resource, content);
          return [
            String(item.contentId),
            content.origin === "USER_INPUT" ? "custom" : "catalog",
          ] as const;
        } catch {
          return [String(item.contentId), "error"] as const;
        }
      }),
    ).then((entries) => {
      if (active) setOrigins(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [items, userId, retry]);
  const visibleItems = useMemo(
    () =>
      filterValue === "CUSTOM"
        ? items.filter((item) => origins[String(item.contentId)] === "custom")
        : items,
    [items, origins, filterValue],
  );
  const originsPending =
    filterValue === "CUSTOM" &&
    items.some((item) => !origins[String(item.contentId)]);

  const groups = useMemo(() => {
    const week = localStartOfWeek(new Date());
    const previous = new Date(week);
    previous.setDate(previous.getDate() - 7);
    return [
      {
        label: "이번 주",
        items: visibleItems.filter(
          (item) => new Date(item.completedAt) >= week,
        ),
      },
      {
        label: "지난주",
        items: visibleItems.filter((item) => {
          const date = new Date(item.completedAt);
          return date >= previous && date < week;
        }),
      },
      {
        label: "이전 기록",
        items: visibleItems.filter(
          (item) => new Date(item.completedAt) < previous,
        ),
      },
    ].filter((group) => group.items.length > 0);
  }, [visibleItems]);

  async function loadMore() {
    if (moreBusy.current || refreshing || loadingList || !hasNext) return;
    moreBusy.current = true;
    const requestGeneration = generation.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const value = await api.myPage.listTrainingSessions({
        type: kind,
        status: "COMPLETED",
        page: page + 1,
        size: 20,
      });
      if (requestGeneration !== generation.current) return;
      const nextItems = mergeHistoryItems(items, value.items);
      setItems(nextItems);
      setPage(value.page);
      setHasNext(Boolean(value.hasNext));
      writeUserClientCache<HistoryCache>(userId, historyCacheResource(kind), {
        items: nextItems,
        page: value.page,
        hasNext: Boolean(value.hasNext),
      });
    } catch (reason) {
      if (requestGeneration !== generation.current) return;
      setLoadMoreError(
        reason instanceof Error
          ? reason.message
          : "기록을 더 불러오지 못했습니다.",
      );
    } finally {
      if (requestGeneration === generation.current) {
        moreBusy.current = false;
        setLoadingMore(false);
      }
    }
  }

  return (
    <AppShell
      mainRef={mainScroll}
      chromeColor="#f2f4f6"
      viewportLocked
      className="relative flex flex-col overflow-hidden bg-[#f2f4f6]"
    >
      <header className="flex h-[52px] shrink-0 items-center px-5 py-2">
        <h1 className="text-[22px] leading-6 font-bold text-[#191f28]">기록</h1>
      </header>
      <div
        ref={listScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        <div className="overflow-hidden px-5 pt-2 pb-6">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((filter) => (
              <button
                key={filter.label}
                type="button"
                onClick={() => setKind(filter.value)}
                aria-pressed={filterValue === filter.value}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-[13px] leading-[18px] font-medium",
                  filterValue === filter.value
                    ? "bg-[#191f28] font-bold text-white"
                    : "bg-white text-[#4e5968]",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p role="alert" className="text-[13px] text-destructive">
                {error}
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  setRetry((value) => value + 1);
                }}
                className="mt-1 min-h-11 px-2 text-sm font-semibold text-primary disabled:opacity-50"
              >
                다시 시도
              </button>
            </div>
          ) : null}
          {loadingList || originsPending ? (
            <HistoryListSkeleton />
          ) : error ? null : groups.length ? (
            <div className="mt-6 space-y-6">
              {groups.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-2.5 flex items-center gap-1.5 px-1 text-[16px] leading-[18px] font-bold text-[#191f28]">
                    {group.label}
                    <span className="text-sm font-medium text-[#8b95a1]">
                      {group.items.length}개
                    </span>
                  </h2>
                  <div className="divide-y divide-[#f2f4f6] rounded-[20px] bg-white pr-3.5 pl-[18px]">
                    {group.items.map((item) => (
                      <Link
                        key={String(item.sessionId)}
                        href={`/mypage/history/${item.sessionId}`}
                        className="flex min-h-[82px] items-center gap-3 py-[18px]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              className={`shrink-0 rounded-[6px] px-1.5 py-0.5 text-[11px] leading-4 font-bold ${origins[String(item.contentId)] === "custom" ? "bg-[#e6f7ee] text-[#0e7a47]" : item.contentType === "CLASS_PRACTICE" ? "bg-[#f1edff] text-[#6a4ce0]" : item.contentType === "ANNOUNCER" ? "bg-[#ffedef] text-[#f04452]" : item.contentType === "SENTENCE" ? "bg-[#fff3e0] text-[#e58000]" : "bg-[#eaf0ff] text-primary"}`}
                            >
                              {origins[String(item.contentId)] === "custom"
                                ? "내 문장"
                                : TYPE_LABEL[item.contentType]}
                            </span>
                            <span className="text-xs leading-4 text-[#8b95a1]">
                              {relativeDateLabel(item.completedAt)}
                            </span>
                          </span>
                          <strong className="mt-1 block truncate text-[15px] leading-[22px] font-bold text-[#191f28]">
                            {item.title}
                          </strong>
                        </span>
                        <span className="shrink-0 leading-[22px] text-primary">
                          <strong className="text-[20px]">
                            {item.overallScore == null
                              ? "—"
                              : Math.round(item.overallScore)}
                          </strong>
                          {item.overallScore != null && (
                            <span className="text-[13px] font-medium">점</span>
                          )}
                        </span>
                        <Image
                          src="/figma/history-tab/chevron.svg"
                          alt=""
                          width={16}
                          height={16}
                        />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
              {hasNext ? (
                <button
                  type="button"
                  disabled={loadingMore || refreshing}
                  onClick={() => void loadMore()}
                  className="h-12 w-full rounded-full bg-white text-[14px] font-bold text-primary disabled:opacity-50"
                >
                  {loadingMore ? "불러오는 중…" : "기록 더 보기"}
                </button>
              ) : null}
              {loadMoreError ? (
                <p
                  role="alert"
                  className="text-center text-xs text-destructive"
                >
                  {loadMoreError}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="py-12 text-center text-[13px] text-[#8b95a1]">
              아직 저장된 학습 기록이 없어요.
            </p>
          )}
          {filterValue === "CUSTOM" &&
          items.some((item) => origins[String(item.contentId)] === "error") ? (
            <p role="alert" className="mt-3 text-xs text-[#6b7684]">
              일부 내 문장 기록을 확인하지 못했어요.
              <button
                className="ml-2 min-h-11 text-primary"
                onClick={() => setRetry((value) => value + 1)}
              >
                다시 시도
              </button>
            </p>
          ) : null}
          {filterValue === "CUSTOM" && !groups.length && hasNext ? (
            <button
              disabled={loadingMore || refreshing}
              onClick={() => void loadMore()}
              className="min-h-12 w-full rounded-full bg-white text-sm font-bold text-primary"
            >
              {loadingMore ? "불러오는 중…" : "이전 기록 더 확인하기"}
            </button>
          ) : null}
          {filterValue === undefined ? (
            <DirectHistory key={String(userId)} />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function HistoryListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-3">
      <span className="sr-only">기록을 불러오는 중</span>
      <div className="px-1 pt-2 pb-2">
        <SkeletonBlock className="h-3 w-14 bg-[#e5e8eb]" />
      </div>
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="flex min-h-[68px] flex-col justify-center rounded-2xl bg-white py-3.5 pr-3.5 pl-4"
          >
            <div className="flex items-center gap-1.5">
              <SkeletonBlock className="h-[18px] w-9" />
              <SkeletonBlock className="h-4 w-2/5" />
            </div>
            <SkeletonBlock className="mt-2 h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
