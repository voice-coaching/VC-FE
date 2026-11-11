"use client";

import {
  historyContentKinds,
  visibleHistoryItems,
  type HistoryContentKind,
} from "@/lib/history-visibility";
import { DirectHistory } from "@/components/direct-history";

import { SkeletonBlock } from "@/components/skeleton-block";
import { NotebookPen } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const [origins, setOrigins] = useState<Record<string, HistoryContentKind>>(
    {},
  );
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
    void historyContentKinds(items, async (id) => {
      const resource = cacheResources.practiceContent(id);
      const content =
        readUserClientCache<PracticeContent>(userId, resource) ??
        (await api.content.get(id));
      writeUserClientCache(userId, resource, content);
      return content;
    }).then((kinds) => {
      if (active) setOrigins(kinds);
    });
    return () => {
      active = false;
    };
  }, [items, userId, retry]);
  const visibleItems = useMemo(
    () => visibleHistoryItems(items, origins, filterValue === "CUSTOM"),
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
      chromeColor="#ffffff"
      viewportLocked
      className="relative flex flex-col overflow-hidden bg-white [--primary:#6346f6]"
    >
      <header className="flex h-[52px] shrink-0 items-center px-5 py-2">
        <h1 className="w-full text-center text-[17px] leading-6 font-bold text-[#191f28]">
          기록
        </h1>
      </header>
      <div
        ref={listScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        <div className="overflow-hidden px-5 pb-6">
          <HistoryFilterTabs
            filters={FILTERS}
            active={filterValue}
            onSelect={setKind}
          />

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
            <div
              key={String(filterValue)}
              className="app-tab-panel mt-5 space-y-7"
            >
              {groups.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-1 flex items-center gap-1 text-[14px] leading-[18px] font-bold text-[#191f28]">
                    {group.label}
                    <span className="text-sm font-bold text-primary">
                      {group.items.length}
                    </span>
                  </h2>
                  <div className="divide-y divide-[#f2f4f6] bg-white">
                    {group.items.map((item) => (
                      <Link
                        key={String(item.sessionId)}
                        href={`/mypage/history/${item.sessionId}`}
                        className="flex min-h-[86px] items-center gap-3 py-[18px]"
                      >
                        <span className="min-w-0 flex-1">
                          <strong className="mb-2 block break-words text-[16px] leading-[22px] font-bold tracking-[-0.24px] text-[#191f28]">
                            {item.title}
                          </strong>
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              className={`shrink-0 rounded-[6px] px-1.5 py-0.5 text-[11px] leading-4 font-bold ${origins[String(item.contentId)] === "custom" ? "bg-[#e6f7ee] text-[#0e7a47]" : item.contentType === "CLASS_PRACTICE" ? "bg-[#f1edff] text-[#6a4ce0]" : item.contentType === "ANNOUNCER" ? "bg-[#ffedee] text-[#c9303d]" : item.contentType === "SENTENCE" ? "bg-[#fff3e0] text-[#c26a00]" : "bg-[#edeaff] text-primary"}`}
                            >
                              {origins[String(item.contentId)] === "custom"
                                ? "내 문장"
                                : TYPE_LABEL[item.contentType]}
                            </span>
                            <span className="text-xs leading-4 text-[#8b95a1]">
                              {relativeDateLabel(item.completedAt)}
                            </span>
                          </span>
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
            <div key={String(filterValue)} className="app-tab-panel">
              <HistoryEmpty filter={filterValue} />
            </div>
          )}
          {items.some((item) => origins[String(item.contentId)] === "error") ? (
            <p role="alert" className="mt-3 text-xs text-[#6b7684]">
              {filterValue === "CUSTOM"
                ? "일부 내 문장 분류를 확인하지 못했어요."
                : "일부 기록의 분류를 확인하지 못했어요. 완료된 기록은 계속 표시합니다."}
              <button
                className="ml-2 min-h-11 text-primary"
                onClick={() => setRetry((value) => value + 1)}
              >
                다시 시도
              </button>
            </p>
          ) : null}
          {!groups.length && hasNext ? (
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

// Mirrors a date group: heading, then divided rows of title / type + date / score.
export function HistoryListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-5">
      <span className="sr-only">기록을 불러오는 중</span>
      <SkeletonBlock className="mb-1 h-[18px] w-16" />
      <div className="divide-y divide-[#f2f4f6]">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="flex min-h-[86px] items-center gap-3 py-[18px]"
          >
            <div className="min-w-0 flex-1">
              <SkeletonBlock
                className={`h-[18px] ${index % 2 ? "w-1/2" : "w-3/5"}`}
              />
              <div className="mt-2.5 flex items-center gap-1.5">
                <SkeletonBlock className="h-5 w-10 rounded-[6px]" />
                <SkeletonBlock className="h-3 w-12" />
              </div>
            </div>
            <SkeletonBlock className="h-5 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_COPY: Record<
  string,
  { title: string; body: string; href: string; cta: string }
> = {
  ALL: {
    title: "아직 연습 기록이 없어요",
    body: "첫 연습을 마치면 점수와 피드백이 여기에 쌓여요",
    href: "/home",
    cta: "첫 연습 시작하기",
  },
  NEWS: {
    title: "아직 뉴스 연습 기록이 없어요",
    body: "오늘의 뉴스를 소리 내어 읽어 보세요",
    href: "/news",
    cta: "뉴스 연습하러 가기",
  },
  SENTENCE: {
    title: "아직 문장 연습 기록이 없어요",
    body: "짧은 문장부터 가볍게 시작해 보세요",
    href: "/sentences",
    cta: "문장 연습하러 가기",
  },
  ANNOUNCER: {
    title: "아직 아나운서 연습 기록이 없어요",
    body: "아나운서 멘트를 따라 읽어 보세요",
    href: "/announcer",
    cta: "따라 읽으러 가기",
  },
  CUSTOM: {
    title: "아직 내 문장 연습 기록이 없어요",
    body: "직접 쓴 문장으로 연습해 보세요",
    href: "/my-script",
    cta: "내 문장 만들러 가기",
  },
  CLASS_PRACTICE: {
    title: "아직 클래스 연습 기록이 없어요",
    body: "발음과 억양 클래스를 하나씩 들어 보세요",
    href: "/class",
    cta: "클래스 보러 가기",
  },
};

/** Empty history: an icon, a line about what will appear, and a way to start. */
function HistoryEmpty({ filter }: { filter?: string }) {
  const copy = EMPTY_COPY[filter ?? "ALL"] ?? EMPTY_COPY.ALL;
  return (
    <div className="flex flex-col items-center px-6 pt-20 pb-12 text-center">
      {/* Quiet on purpose: the copy and button carry the message. */}
      <NotebookPen
        size={44}
        strokeWidth={1.6}
        className="text-[#c9ced4]"
        aria-hidden="true"
      />
      <h2 className="mt-4 text-[17px] leading-6 font-bold text-[#191f28]">
        {copy.title}
      </h2>
      <p className="mt-1.5 text-[14px] leading-5 break-keep text-[#8b95a1]">
        {copy.body}
      </p>
      <Link
        href={copy.href}
        className="mt-6 inline-flex h-11 items-center rounded-full bg-[#f1edff] px-5 text-[14px] font-bold text-[#6346f6]"
      >
        {copy.cta}
      </Link>
    </div>
  );
}

/**
 * Filter tabs with one underline that glides between items: the same motion
 * as the class and My page tabs (360ms, ease-out), so every tab bar matches.
 */
function HistoryFilterTabs<T>({
  filters,
  active,
  onSelect,
}: {
  filters: Array<{ value?: T; label: string }>;
  active?: T;
  onSelect: (value?: T) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = Math.max(
    0,
    filters.findIndex((filter) => filter.value === active),
  );
  useLayoutEffect(() => {
    const button = strip.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    if (button) setBar({ left: button.offsetLeft, width: button.offsetWidth });
  }, [activeIndex]);
  return (
    <div
      ref={strip}
      className="relative -mx-5 flex gap-5 overflow-x-auto border-b border-[#f2f4f6] px-5 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {filters.map((filter, index) => (
        <button
          key={filter.label}
          type="button"
          data-index={index}
          onClick={() => onSelect(filter.value)}
          aria-pressed={index === activeIndex}
          className={cn(
            "shrink-0 pb-2.5 text-[15px] leading-[18px] font-bold tracking-[-0.225px] transition-colors duration-[260ms] motion-reduce:transition-none",
            index === activeIndex ? "text-[#191f28]" : "text-[#8b95a1]",
          )}
        >
          {filter.label}
        </button>
      ))}
      {bar && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-[#191f28] transition-[transform,width] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${bar.left}px)`, width: bar.width }}
        />
      )}
    </div>
  );
}
