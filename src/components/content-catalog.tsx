"use client";
import { practiceDetailHref } from "@/lib/practice-entry";

import { NewsRankingCarousel } from "./news-ranking-carousel";
import { SkeletonBlock } from "@/components/skeleton-block";
import Image from "next/image";
import Link from "next/link";
import { CatalogDifficultyPicker } from "@/components/catalog-difficulty-picker";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import {
  api,
  type ContentFacets,
  type ContentFacetOption,
  type ContentType,
  type Difficulty,
  type PracticeContentSummary,
} from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import { readUserClientCache, writeUserClientCache } from "@/lib/client-cache";
import { categoryLabel } from "@/lib/content-labels";
import {
  sentenceCategoryOptions,
  sentenceCategoryRequest,
} from "@/lib/content-category";
import { newsHeadline, newsCategoryTags } from "@/lib/news-presentation";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import { useHistoryScroll } from "@/hooks/use-history-scroll";
import {
  createCatalogSnapshot,
  refreshCatalogWindow,
} from "@/lib/catalog-pages";
import { getAuthSessionVersion } from "@/lib/api/client";
import {
  catalogFacetsForPractice,
  catalogItemsForPractice,
} from "@/lib/catalog-visibility";

const DIFFICULTIES: Array<{ value: Difficulty | ""; label: string }> = [
  { value: "", label: "모든 난이도" },
  { value: "BEGINNER", label: "초급" },
  { value: "INTERMEDIATE", label: "중급" },
  { value: "ADVANCED", label: "고급" },
];

const difficultyLabel: Record<Difficulty, string> = {
  BEGINNER: "초급",
  INTERMEDIATE: "중급",
  ADVANCED: "고급",
};

const SENTENCE_FILTER_PRESENTATION: Record<
  string,
  { symbol: string; description: string }
> = {
  FINAL_CONSONANT: { symbol: "ㄹ", description: "끝소리를 또렷하게" },
  TENSE_CONSONANT: { symbol: "ㄲ", description: "힘주어 정확하게" },
  CONSONANT: { symbol: "ㄹ", description: "첫소리를 분명하게" },
  VOWEL: { symbol: "ㅏ", description: "입 모양을 정확하게" },
};

type CatalogCache = {
  items: PracticeContentSummary[];
  totalElements: number;
  page: number;
  hasNext: boolean;
};

function catalogCacheResource(
  type: ContentType,
  category: string,
  difficulty: Difficulty | "",
) {
  return `content-${type === "NEWS" ? "NEWS-fields-v2" : type === "SENTENCE" ? "SENTENCE-facets-v2" : type}-${category || "all"}-${difficulty || "all"}`;
}

function practiceHref(id: PracticeContentSummary["id"], returnTo: string) {
  return practiceDetailHref(id, returnTo);
}

export function ContentCatalog({
  type,
  title,
  description,
}: {
  type: ContentType;
  title: string;
  description: string;
}) {
  const returnTo =
    type === "NEWS"
      ? "/news"
      : type === "SENTENCE"
        ? "/sentences"
        : "/announcer";
  const userId = getAuthenticatedUserId();
  const [completedSentences, setCompletedSentences] = useState<Set<string>>(
    new Set(),
  );
  const [completionKnown, setCompletionKnown] = useState(false);
  useEffect(() => {
    let active = true;
    setCompletionKnown(false);
    setCompletedSentences(new Set());
    if (type !== "SENTENCE" && type !== "ANNOUNCER") return;
    void (async () => {
      const completed = new Set<string>();
      for (let page = 0; active; page++) {
        const result = await api.myPage.listTrainingSessions({
          type,
          status: "COMPLETED",
          page,
          size: 100,
        });
        if (!active) return;
        result.items
          .filter((item) => item.status === "COMPLETED")
          .forEach((item) => completed.add(String(item.contentId)));
        setCompletedSentences(new Set(completed));
        if (
          !result.items.length ||
          !(
            result.hasNext ??
            page + 1 <
              (result.totalPages ??
                Math.ceil(result.totalElements / result.size))
          )
        )
          break;
      }
      if (active) setCompletionKnown(true);
    })().catch(() => {
      /* Unknown completion stays unmarked. */
    });
    return () => {
      active = false;
    };
  }, [userId, type]);
  const { category, difficulty, setCategory, setDifficulty } =
    useCatalogFilters(
      `${userId}:${type === "SENTENCE" ? "SENTENCE-facets-v2" : type === "NEWS" ? "NEWS-fields-v2" : type}`,
    );
  const [facetRetry, setFacetRetry] = useState(0);
  const facetScope = `${userId}:${type}`;
  const [sentenceFacets, setSentenceFacets] = useState<{
    scope: string;
    status: "loading" | "ready" | "error";
    options: ContentFacetOption[];
    error?: string;
  }>({ scope: facetScope, status: "loading", options: [] });
  const facetsCurrent = sentenceFacets.scope === facetScope;
  const facetsReady = facetsCurrent && sentenceFacets.status === "ready";
  const facetError =
    facetsCurrent && sentenceFacets.status === "error"
      ? sentenceFacets.error
      : undefined;
  const sentenceOptions = facetsCurrent ? sentenceFacets.options : [];
  const firstSentenceCategory = sentenceOptions[0]?.value;
  useEffect(() => {
    if (
      type === "SENTENCE" &&
      facetsReady &&
      !category &&
      firstSentenceCategory
    )
      setCategory(firstSentenceCategory);
  }, [type, facetsReady, category, firstSentenceCategory, setCategory]);
  const requestedCategory =
    type === "SENTENCE"
      ? sentenceCategoryRequest(category, sentenceOptions, facetsReady)
      : category || undefined;
  const previousFilters = useRef(
    JSON.stringify([userId, type, category, difficulty]),
  );
  const [difficultyOptions, setDifficultyOptions] = useState(DIFFICULTIES);
  const [initialCache] = useState(() =>
    readUserClientCache<CatalogCache>(
      userId,
      catalogCacheResource(type, category, difficulty),
    ),
  );
  const [items, setItems] = useState<PracticeContentSummary[]>(
    initialCache?.items ?? [],
  );
  const [totalElements, setTotalElements] = useState(
    initialCache?.totalElements ?? 0,
  );
  const [loading, setLoading] = useState(initialCache === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(initialCache?.page ?? 0);
  const [hasNext, setHasNext] = useState(initialCache?.hasNext ?? false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const newsSnapshot = useRef<{
    userId: string | null;
    retry: number;
    epoch: number;
    identity: symbol;
    source: { read(): Promise<PracticeContentSummary[] | null> };
  } | null>(null);
  useEffect(
    () => () => {
      newsSnapshot.current = null;
    },
    [],
  );
  const loadMoreBusy = useRef(false);
  const scope = `${userId}:${catalogCacheResource(type, category, difficulty)}`;
  const [loadedScope, setLoadedScope] = useState(scope);
  const scrollRef = useHistoryScroll(scope, !loading && loadedScope === scope);

  useEffect(() => {
    let active = true;
    if (type === "SENTENCE")
      setSentenceFacets({ scope: facetScope, status: "loading", options: [] });
    const resource = cacheResources.contentFacets(type);
    const applyFacets = (facets: ContentFacets) => {
      const visibleFacets = catalogFacetsForPractice(type, facets);
      if (type === "SENTENCE") {
        setSentenceFacets({
          scope: facetScope,
          status: "ready",
          options: sentenceCategoryOptions(facets),
        });
        return;
      }
      if (visibleFacets.difficulties.length)
        setDifficultyOptions([
          DIFFICULTIES[0],
          ...visibleFacets.difficulties.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]);
    };
    const cached = readUserClientCache<ContentFacets>(userId, resource);
    if (cached && type !== "SENTENCE") applyFacets(cached);
    api.content
      .getFacets(type)
      .then((facets) => {
        if (!active) return;
        applyFacets(facets);
        writeUserClientCache(
          userId,
          resource,
          catalogFacetsForPractice(type, facets),
        );
      })
      .catch(() => {
        if (active && type === "SENTENCE")
          setSentenceFacets({
            scope: facetScope,
            status: "error",
            options: [],
            error: "문장 카테고리를 불러오지 못했어요. 다시 시도해 주세요.",
          });
      });
    return () => {
      active = false;
    };
  }, [type, userId, facetScope, facetRetry]);

  useEffect(() => {
    let active = true;
    const resource = catalogCacheResource(type, category, difficulty);
    generation.current += 1;
    loadMoreBusy.current = false;
    setLoadingMore(false);
    setLoadMoreError(null);
    setRefreshing(true);
    if (requestedCategory === null) {
      setItems([]);
      setTotalElements(0);
      setPage(0);
      setHasNext(false);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return () => {
        active = false;
        generation.current += 1;
      };
    }
    const filterIdentity = JSON.stringify([userId, type, category, difficulty]);
    const filtersChanged = previousFilters.current !== filterIdentity;
    previousFilters.current = filterIdentity;
    const cached = filtersChanged
      ? null
      : readUserClientCache<CatalogCache>(userId, resource);
    setLoadedScope(scope);
    if (cached) {
      setItems(cached.items);
      setTotalElements(cached.totalElements);
      setPage(cached.page);
      setHasNext(cached.hasNext);
      setLoading(false);
    } else {
      setItems([]);
      setTotalElements(0);
      setPage(0);
      setHasNext(false);
      setLoading(true);
    }
    setError(null);
    async function fetchNewsTopics() {
      let current = newsSnapshot.current;
      const epoch = getAuthSessionVersion();
      if (
        !current ||
        current.userId !== userId ||
        current.retry !== retry ||
        current.epoch !== epoch
      ) {
        const identity = Symbol("news-snapshot");
        current = {
          userId,
          retry,
          epoch,
          identity,
          source: createCatalogSnapshot(
            (page) => api.content.list({ type: "NEWS", page, size: 100 }),
            () =>
              newsSnapshot.current?.identity === identity &&
              getAuthSessionVersion() === epoch,
          ),
        };
        newsSnapshot.current = current;
      }
      const news = await current.source.read();
      if (!active || !news) return null;
      const filtered = news.filter((item) => {
        return (
          (!category || categoryLabel(item.category).trim() === category) &&
          (!difficulty || item.difficulty === difficulty)
        );
      });
      return {
        items: filtered,
        totalElements: filtered.length,
        page: 0,
        hasNext: false,
      };
    }
    (type === "NEWS"
      ? fetchNewsTopics()
      : refreshCatalogWindow(
          (page) =>
            api.content.list({
              type,
              category: requestedCategory,
              difficulty: difficulty || undefined,
              page,
              size: 20,
            }),
          cached?.page ?? 0,
          () => active,
        )
    )
      .then((result) => {
        if (!active || !result) return;
        setItems(result.items);
        setTotalElements(result.totalElements);
        setPage(result.page);
        setHasNext(Boolean(result.hasNext));
        writeUserClientCache<CatalogCache>(userId, resource, {
          items: result.items,
          totalElements: result.totalElements,
          page: result.page,
          hasNext: Boolean(result.hasNext),
        });
      })
      .catch((reason) => {
        if (active && !cached) {
          setError(
            reason instanceof Error
              ? reason.message
              : "콘텐츠를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [category, difficulty, type, userId, retry, scope, requestedCategory]);

  async function loadMore() {
    if (
      loadMoreBusy.current ||
      refreshing ||
      !hasNext ||
      requestedCategory === null ||
      loadedScope !== scope
    )
      return;
    loadMoreBusy.current = true;
    const requestGeneration = generation.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await api.content.list({
        type,
        category: requestedCategory,
        difficulty: difficulty || undefined,
        page: page + 1,
        size: 20,
      });
      if (requestGeneration !== generation.current) return;
      const merged = new Map(items.map((item) => [String(item.id), item]));
      for (const item of result.items) merged.set(String(item.id), item);
      const nextItems = [...merged.values()];
      setItems(nextItems);
      setTotalElements(result.totalElements);
      setPage(result.page);
      setHasNext(Boolean(result.hasNext));
      writeUserClientCache<CatalogCache>(
        userId,
        catalogCacheResource(type, category, difficulty),
        {
          items: nextItems,
          totalElements: result.totalElements,
          page: result.page,
          hasNext: Boolean(result.hasNext),
        },
      );
    } catch (reason) {
      if (requestGeneration !== generation.current) return;
      setLoadMoreError(
        reason instanceof Error
          ? reason.message
          : "콘텐츠를 더 불러오지 못했습니다.",
      );
    } finally {
      if (requestGeneration === generation.current) {
        loadMoreBusy.current = false;
        setLoadingMore(false);
      }
    }
  }

  const visibleItems = catalogItemsForPractice(type, items);
  const hiddenLoadedItems = items.length - visibleItems.length;
  const visibleTotalElements = Math.max(
    visibleItems.length,
    totalElements - hiddenLoadedItems,
  );
  const featured =
    type === "ANNOUNCER"
      ? (visibleItems.find(
          (item) => !/(?:\btest\b|테스트)/i.test(item.title),
        ) ?? visibleItems[0])
      : visibleItems[0];

  return (
    <AppShell
      mainRef={scrollRef}
      chromeColor="#ffffff"
      nav={type !== "ANNOUNCER"}
      className="bg-white [--primary:#6346f6]"
    >
      <CatalogHeader title={title} />
      <p className="sr-only">{description}</p>

      {type === "NEWS" ? <NewsRankingCarousel /> : null}

      {type === "NEWS" ? (
        <NewsFilterBar category={category} onCategory={setCategory} />
      ) : null}

      {type === "SENTENCE" ? (
        <SentenceFilters
          category={category}
          options={sentenceOptions}
          loading={!facetsReady && !facetError}
          error={facetError}
          onRetry={() => setFacetRetry((value) => value + 1)}
          onCategory={(value) => {
            if (
              value &&
              !sentenceOptions.some((option) => option.value === value)
            )
              return;
            setPage(0);
            setCategory(value);
          }}
        />
      ) : null}

      {type === "ANNOUNCER" && featured ? (
        <AnnouncerHero
          item={featured}
          returnTo={returnTo}
          completed={
            completionKnown
              ? completedSentences.has(String(featured.id))
              : undefined
          }
        />
      ) : null}

      <section className="px-5 pb-8">
        <div
          className={`flex items-center justify-between ${
            type === "NEWS"
              ? "pt-5 pb-1"
              : type === "ANNOUNCER"
                ? "pt-6"
                : "pt-5 pb-1"
          }`}
        >
          <h2 className={"text-sm leading-5 font-bold"}>
            {type === "NEWS" ? (
              <>
                {category || "전체"}
                {!loading ? (
                  <span className="ml-1.5 text-primary">
                    {visibleTotalElements}
                  </span>
                ) : null}
              </>
            ) : null}
            {type === "ANNOUNCER" ? (
              <>
                전체 멘트{" "}
                <span className="text-primary">{visibleTotalElements}</span>
              </>
            ) : null}
            {type === "SENTENCE" ? (
              <>
                {sentenceOptions.find((option) => option.value === category)
                  ?.label ?? (category ? "선택한" : "전체")}{" "}
                문장
                <span className="ml-2 text-primary">
                  {visibleTotalElements}
                </span>
              </>
            ) : null}
          </h2>
          {type === "NEWS" && (
            <CatalogDifficultyPicker
              variant="news"
              value={difficulty}
              options={difficultyOptions}
              onChange={setDifficulty}
            />
          )}
        </div>

        {requestedCategory === null ? (
          <p role="status" className="py-12 text-center text-sm text-[#8b95a1]">
            {facetsReady
              ? "선택한 카테고리를 사용할 수 없어요. 전체 문장을 선택해 주세요."
              : "카테고리를 확인한 뒤 문장을 불러올게요."}
          </p>
        ) : loading ? (
          <CatalogListSkeleton type={type} />
        ) : error ? (
          <div className="mt-4 rounded-2xl bg-[#fff0f2] p-4 text-sm text-[#d91b34] [overflow-wrap:anywhere]">
            <p role="alert">{error}</p>
            <button
              type="button"
              className="mt-2 min-h-11 font-semibold text-primary"
              onClick={() => setRetry((value) => value + 1)}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div
            className={
              type === "NEWS" ? "flex flex-col gap-3" : "flex flex-col gap-3"
            }
          >
            <div
              className={type !== "ANNOUNCER" ? "bg-white" : "flex flex-col"}
            >
              {visibleItems.map((item, index) => (
                <CatalogItem
                  key={String(item.id)}
                  item={item}
                  index={index}
                  completionKnown={completionKnown}
                  completed={
                    (type === "SENTENCE" || type === "ANNOUNCER") &&
                    completedSentences.has(String(item.id))
                  }
                  type={type}
                  href={practiceHref(item.id, returnTo)}
                />
              ))}
            </div>
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <p className="text-sm text-[#8b95a1]">
                  조건에 맞는 콘텐츠가 없어요.
                </p>
                {category || difficulty ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCategory("");
                      setDifficulty("");
                    }}
                    className="mt-3 min-h-11 rounded-full bg-white px-5 text-sm font-bold text-primary"
                  >
                    필터 초기화
                  </button>
                ) : null}
              </div>
            ) : null}
            {hasNext ? (
              <>
                {loadMoreError ? (
                  <p
                    role="alert"
                    className="rounded-2xl bg-[#fff0f2] p-4 text-sm text-[#d91b34] [overflow-wrap:anywhere]"
                  >
                    {loadMoreError}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={loadingMore || refreshing}
                  onClick={() => void loadMore()}
                  className="mt-1 h-12 rounded-full border border-[#e5e8eb] bg-white text-sm font-bold disabled:opacity-50"
                >
                  {loadingMore
                    ? "불러오는 중…"
                    : loadMoreError
                      ? "더 보기 다시 시도"
                      : "더 보기"}
                </button>
              </>
            ) : null}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function CatalogHeader({ title }: { title: string }) {
  return (
    <header className="relative flex h-12 items-center px-2 py-1">
      <BackButton
        fallback="/home"
        className="flex size-10 items-center justify-center"
      >
        <Image
          src={
            title === "뉴스 읽기"
              ? "/figma/news-improved/back.svg"
              : "/figma/home/chevron-left.svg"
          }
          alt=""
          width={24}
          height={24}
        />
      </BackButton>
      <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold">
        {title === "따라 읽기" ? "아나운서 따라 읽기" : title}
      </h1>
    </header>
  );
}

// News tabs represent fields, not headline keywords.
function NewsFilterBar({
  category,
  onCategory,
}: {
  category: string;
  onCategory: (value: string) => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center border-b border-[#f2f4f6] bg-white pt-[18px]">
      <nav
        aria-label="뉴스 카테고리"
        className="flex min-w-0 flex-1 gap-5 overflow-x-auto px-5 [scrollbar-width:none]"
      >
        {["", "사회", "경제", "문화", "스포츠"].map((value) => (
          <button
            key={value || "all"}
            type="button"
            aria-pressed={category === value}
            onClick={() => onCategory(value)}
            className={`shrink-0 border-b-2 pb-2.5 text-[15px] leading-[21px] font-medium ${category === value ? "border-[#191f28] font-bold text-[#191f28]" : "border-transparent text-[#8b95a1]"}`}
          >
            {value || "전체"}
          </button>
        ))}
      </nav>
    </div>
  );
}

function newsMetadata(item: PracticeContentSummary) {
  const publisher = item.publisher?.trim();
  return [
    publisher && !/^speak(?:ai)?\s*학습\s*콘텐츠$/i.test(publisher)
      ? publisher
      : undefined,
    item.sentenceCount != null && item.sentenceCount > 0
      ? `${item.sentenceCount}문장`
      : null,
  ].filter((value): value is string => Boolean(value));
}

const newsCategoryIcons: Record<string, string> = {
  사회: "society",
  경제: "economy",
  문화: "culture",
  스포츠: "sports",
};
const newsDifficultyStyle: Record<Difficulty, string> = {
  BEGINNER: "bg-[#e8f7f0] text-[#0e9f6e]",
  INTERMEDIATE: "bg-[#f0edff] text-[#6346f6]",
  ADVANCED: "bg-[#ffeef0] text-[#f04452]",
};

function SentenceFilters({
  category,
  onCategory,
  options,
  loading,
  error,
  onRetry,
}: {
  category: string;
  onCategory: (value: string) => void;
  options: ContentFacetOption[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <section className="border-b-8 border-[#f2f4f6] px-5 pt-4 pb-6">
      <h2 className="text-[17px] leading-6 font-bold">
        연습할 소리를 골라보세요
      </h2>
      {loading ? (
        <div
          role="status"
          aria-label="문장 카테고리 불러오는 중"
          className="mt-3 grid grid-cols-2 gap-2.5"
        >
          {[0, 1, 2, 3].map((index) => (
            <SkeletonBlock key={index} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error || !options.length ? (
        <div className="mt-3 rounded-2xl bg-white p-4 text-sm">
          <p role={error ? "alert" : "status"}>
            {error ?? "현재 선택할 수 있는 연습 카테고리가 없어요."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 min-h-11 font-semibold text-primary"
          >
            카테고리 다시 불러오기
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {options.map((item) => {
            const selected = category === item.value;
            const presentation = SENTENCE_FILTER_PRESENTATION[item.value];
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onCategory(item.value)}
                className={`flex min-h-[72px] items-center gap-2.5 rounded-2xl border-[1.5px] py-3 pl-3 pr-2 text-left transition-colors ${selected ? "border-[#6346f6] bg-[#f4f1ff]" : "border-transparent bg-[#f7f8fa] shadow-[0_2px_6px_rgba(26,33,48,0.05)]"}`}
              >
                <SentenceGlyph category={item.value} />
                <span className="min-w-0">
                  <strong className="block text-[15px] leading-[22px]">
                    {item.label}
                  </strong>
                  <span className="mt-1 block text-xs leading-4 text-[#8b95a1]">
                    {presentation.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AnnouncerHero({
  item,
  completed,
  returnTo,
}: {
  item: PracticeContentSummary;
  returnTo: string;
  completed?: boolean;
}) {
  const [opening, setOpening] = useState<{
    id: string;
    text: string;
    title: string;
    count: number;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void api.content
      .get(item.id)
      .then((detail) => {
        if (active)
          setOpening({
            id: String(item.id),
            text:
              detail.sentences?.[0]?.text ||
              detail.scriptText.split(/(?<=[.!?。])\s+|\n/)[0],
            title: /^아나운서\s*따라\s*읽기(?:\s*\d+)?$/.test(item.title.trim())
              ? announcerTopicTitle(detail.scriptText)
              : item.title,
            count:
              detail.sentenceCount ||
              detail.sentences?.length ||
              detail.scriptText
                .split(/(?<=[.!?。])\s+|\n/)
                .filter((text) => text.trim()).length,
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [item.id, item.title]);
  const date = item.publishedAt ? new Date(item.publishedAt) : new Date();
  return (
    <section className="border-b-8 border-[#f2f4f6] px-5 pt-3 pb-6">
      <h2 className="text-[17px] leading-6 font-bold">오늘의 아나운서 멘트</h2>
      <p className="mt-1 text-xs leading-4 font-medium text-[#8b95a1]">
        매일 한 문장씩 아나운서처럼 읽어봐요
      </p>
      <div className="relative mt-3 min-h-[200px] overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_at_88%_35%,#9c7bff29,transparent_65%),linear-gradient(153.56deg,#dce7ff_14.286%,#eaddff_85.714%)] p-5 text-[#191f28]">
        <Image
          src="/figma/announcer-screen7/character-current.png"
          alt="아나운서 Speak AI 캐릭터"
          width={140}
          height={140}
          className="pointer-events-none absolute right-2 bottom-2 size-[140px] object-cover"
        />
        <div className="relative z-10 flex min-h-[160px] flex-col items-start gap-2">
          {!Number.isNaN(date.getTime()) && (
            <span className="px-2 py-[3px] text-[11px] leading-[14px] font-bold text-[#6346f6]">
              {new Intl.DateTimeFormat("ko-KR", {
                month: "long",
                day: "numeric",
              }).format(date)}
            </span>
          )}
          <h3 className="line-clamp-2 max-w-[230px] break-words text-xl leading-7 font-bold">
            {announcerDisplayTitle(
              opening?.id === String(item.id) ? opening.title : item.title,
            )}
          </h3>
          <div className="flex max-w-full flex-wrap items-center gap-[7px] text-xs leading-4 text-[#6b7684]">
            <AnnouncerMetadata
              completed={completed}
              item={
                opening?.id === String(item.id)
                  ? { ...item, sentenceCount: opening.count }
                  : item
              }
            />
          </div>
          <Link
            href={practiceHref(item.id, returnTo)}
            className="mt-5 flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#6346f6] py-[11px] pr-5 pl-4 text-sm leading-5 font-bold text-white"
          >
            <Image
              src="/figma/announcer-screen7/mic.svg"
              alt=""
              width={16}
              height={16}
            />
            연습 시작하기
          </Link>
        </div>
      </div>
    </section>
  );
}

function AnnouncerMetadata({
  item,
  completed,
}: {
  item: PracticeContentSummary;
  completed?: boolean;
}) {
  const [resolved, setResolved] = useState<{
    id: string;
    count: number;
  } | null>(null);
  useEffect(() => {
    if (item.sentenceCount != null && item.sentenceCount > 0) return;
    let active = true;
    void api.content
      .get(item.id)
      .then((detail) => {
        const count =
          detail.sentenceCount ||
          detail.sentences?.length ||
          detail.scriptText
            ?.split(/(?<=[.!?。])\s+|\n/)
            .filter((text) => text.trim()).length ||
          0;
        if (active) setResolved({ id: String(item.id), count });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [item.id, item.sentenceCount]);
  const count =
    item.sentenceCount ||
    (resolved?.id === String(item.id) ? resolved.count : 0);
  return (
    <>
      {count > 0 && <span>{count}문장</span>}
      {completed && (
        <>
          {count > 0 && (
            <span aria-hidden="true" className="h-2.5 w-px bg-[#e5e8eb]" />
          )}
          <span className="inline-flex items-center gap-1 font-medium text-[#6346f6]">
            <Image
              src="/figma/sentences-screen7/check.svg"
              alt=""
              width={12}
              height={12}
            />
            연습 완료
          </span>
        </>
      )}
    </>
  );
}

function announcerDisplayTitle(title: string) {
  const clean = title.replace(/^\s*#{1,6}\s*/, "").trim();
  if (/국제회의/.test(clean) && /개막|점검/.test(clean))
    return "국제회의 개막 전 현장 점검";
  return clean;
}

function announcerTopicTitle(script: string) {
  // Use short editorial topic labels, never the spoken script as a title.
  if (/국제회의/.test(script) && /개막|점검/.test(script))
    return "국제회의 개막 전 현장 점검";
  if (/날씨|기온|강수|비가|맑겠|미세먼지|일교차/.test(script))
    return "날씨 예보 전달하기";
  if (/스포츠|야구|축구|농구|선수|경기|우승/.test(script))
    return "스포츠 하이라이트 소개";
  if (/금리|경제|증시|주가|물가|환율|한국은행/.test(script))
    return "경제 브리핑 리드 문장";
  if (/다큐|내레이션|자연|생태|역사|여정/.test(script))
    return "특집 다큐 내레이션 도입부";
  if (
    /마칩니다|마치겠습니다|시청해|함께해|다음에|편안한|좋은 하루/.test(script)
  )
    return "클로징 인사 멘트";
  if (/속보|긴급/.test(script)) return "속보 전달하기";
  if (/저녁|밤 뉴스/.test(script)) return "저녁 뉴스 오프닝 멘트";
  if (/아침|오전/.test(script)) return "아침 뉴스 오프닝 멘트";
  return "뉴스 오프닝 멘트";
}

function AnnouncerListItem({
  item,
  completed,
  index,
  href,
}: {
  item: PracticeContentSummary;
  href: string;
  index: number;
  completed?: boolean;
}) {
  const generic = /^아나운서\s*따라\s*읽기(?:\s*\d+)?$/.test(item.title.trim());
  const [resolved, setResolved] = useState<{
    id: string;
    title: string;
  } | null>(null);
  useEffect(() => {
    if (!generic) return;
    let active = true;
    void api.content
      .get(item.id)
      .then((detail) => {
        const script =
          detail.scriptText ||
          detail.sentences?.map((sentence) => sentence.text).join(" ") ||
          "";
        const title = announcerTopicTitle(script);
        if (active) setResolved({ id: String(item.id), title });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [item.id, generic]);
  const title = announcerDisplayTitle(
    resolved?.id === String(item.id) ? resolved.title : item.title,
  );
  return (
    <Link
      href={href}
      className="flex items-start gap-3 border-b border-[#f2f4f6] py-[18px] last:border-b-0 active:opacity-70"
    >
      <span className="w-[22px] shrink-0 text-[15px] leading-6 font-bold tabular-nums text-[#a99aff]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <strong className="line-clamp-2 break-words text-base leading-6 text-[#191f28]">
          {title}
        </strong>
        <span className="flex items-center gap-[7px] text-[13px] leading-[18px] text-[#8b95a1]">
          <AnnouncerMetadata item={item} completed={completed} />
        </span>
      </span>
    </Link>
  );
}

function SentenceListItem({
  item,
  href,
  index,
  completed,
}: {
  item: PracticeContentSummary;
  href: string;
  index: number;
  completed: boolean;
}) {
  const [resolved, setResolved] = useState<{ id: string; text: string } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    void api.content
      .get(item.id)
      .then((detail) => {
        const text =
          detail.sentences?.[0]?.text?.trim() ||
          detail.scriptText?.trim().split(/\n|(?<=[.!?。])\s+/)[0];
        if (active && text) setResolved({ id: String(item.id), text });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [item.id]);
  const text =
    resolved?.id === String(item.id)
      ? resolved.text
      : item.title.replace(
          /^(?:받침|된소리|자음|모음)\s*문장\s*연습\s*\d*\s*[-–—:]?\s*/,
          "",
        );
  return (
    <Link
      href={href}
      className="flex items-start gap-3 border-b border-[#f2f4f6] py-[18px] text-[#191f28] last:border-b-0 active:opacity-70"
    >
      <span className="w-[22px] shrink-0 text-[15px] leading-6 font-bold tabular-nums text-[#a99aff]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-base leading-6 font-medium">
          <SentenceText text={text} category={item.category} />
        </span>
        {completed && (
          <span className="flex items-center gap-1 text-xs leading-4 text-[#6346f6]">
            <Image
              src="/figma/sentences-screen7/check.svg"
              alt=""
              width={12}
              height={12}
            />
            연습 완료
          </span>
        )}
      </span>
    </Link>
  );
}

function CatalogItem({
  item,
  completionKnown = false,
  index = 0,
  completed = false,
  type,
  href,
}: {
  item: PracticeContentSummary;
  completed?: boolean;
  completionKnown?: boolean;
  index?: number;
  type: ContentType;
  href: string;
}) {
  if (type === "ANNOUNCER") {
    return (
      <AnnouncerListItem
        item={item}
        href={href}
        index={index}
        completed={completionKnown ? completed : undefined}
      />
    );
  }

  if (type === "SENTENCE") {
    return (
      <SentenceListItem
        item={item}
        href={href}
        index={index}
        completed={completed}
      />
    );
  }

  const { category } = newsCategoryTags(item);
  const icon = newsCategoryIcons[category];
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 border-b border-[#f2f4f6] py-[18px] last:border-b-0 active:opacity-70"
    >
      <strong className="text-base leading-[22px] font-bold text-[#191f28]">
        {newsHeadline(item.title)}
      </strong>
      <span className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-[#8b95a1]">
        <span
          className={`rounded-[6px] px-1.5 py-0.5 text-[11px] leading-4 font-bold ${newsDifficultyStyle[item.difficulty]}`}
        >
          {difficultyLabel[item.difficulty]}
        </span>
        <span className="inline-flex items-center gap-1 px-0.5 py-[5px] text-xs font-bold">
          {icon && (
            <Image
              src={`/figma/news-screen7/${icon}.svg`}
              alt=""
              width={14}
              height={14}
            />
          )}
          {category}
        </span>
        {newsMetadata(item).map((value, index) => (
          <span key={index} className="inline-flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className="h-3 w-px bg-[#d1d6db]" />
            )}
            {value}
          </span>
        ))}
      </span>
    </Link>
  );
}

// Same flat, divided rows as CatalogItem / AnnouncerListItem / SentenceListItem.
function CatalogListSkeleton({ type }: { type: ContentType }) {
  const rowClass =
    "flex items-start gap-3 border-b border-[#f2f4f6] py-[18px] last:border-b-0";
  return (
    <div role="status" aria-busy="true" className="bg-white">
      <span className="sr-only">콘텐츠를 불러오는 중</span>
      {[0, 1, 2, 3, 4].map((index) =>
        type === "NEWS" ? (
          <div
            key={index}
            className="flex flex-col gap-2 border-b border-[#f2f4f6] py-[18px] last:border-b-0"
          >
            <SkeletonBlock
              className={`my-0.5 h-[18px] ${index % 2 ? "w-1/2" : "w-3/5"}`}
            />
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-5 w-9 rounded-[6px]" />
              <SkeletonBlock className="h-3.5 w-12" />
              <SkeletonBlock className="h-3.5 w-10" />
            </div>
          </div>
        ) : (
          <div key={index} className={rowClass}>
            <SkeletonBlock className="mt-[5px] h-3.5 w-[22px] shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <SkeletonBlock
                className={`mt-1 h-4 ${index % 2 ? "w-2/3" : "w-4/5"}`}
              />
              {type === "ANNOUNCER" ? (
                <SkeletonBlock className="h-3 w-20" />
              ) : null}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function SentenceGlyph({ category }: { category: string }) {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      {category === "FINAL_CONSONANT" ? (
        <span className="relative h-[18.321px] w-[27px]">
          <Image
            src="/figma/sentences-screen7/final-left.svg"
            alt=""
            width={15.733}
            height={18.321}
            className="absolute left-0 top-0"
          />
          <Image
            src="/figma/sentences-screen7/final-right.svg"
            alt=""
            width={13.095}
            height={18.176}
            className="absolute right-0 top-0"
          />
        </span>
      ) : (
        <Image
          src={`/figma/sentences-screen7/${category === "TENSE_CONSONANT" ? "tense" : category === "CONSONANT" ? "consonant" : "vowel"}.svg`}
          alt=""
          width={
            category === "TENSE_CONSONANT"
              ? 30
              : category === "CONSONANT"
                ? 23
                : 18.789
          }
          height={
            category === "TENSE_CONSONANT"
              ? 18
              : category === "CONSONANT"
                ? 19.32
                : 28
          }
        />
      )}
    </span>
  );
}
function SentenceText({ text, category }: { text: string; category: string }) {
  return (
    <>
      {Array.from(text).map((char, index) => {
        const code = char.charCodeAt(0) - 0xac00;
        const initial = Math.floor(code / 588),
          final = code % 28,
          vowel = Math.floor(code / 28) % 21;
        const highlight =
          code >= 0 &&
          code < 11172 &&
          (category === "FINAL_CONSONANT"
            ? [3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18].includes(final)
            : category === "TENSE_CONSONANT"
              ? [1, 4, 8, 10, 13].includes(initial)
              : category === "CONSONANT"
                ? [2, 5].includes(initial)
                : category === "VOWEL"
                  ? [1, 3, 5, 7, 9, 10, 11, 14, 15, 16, 19].includes(vowel)
                  : false);
        return (
          <span
            key={index}
            className={highlight ? "text-[#6346f6]" : undefined}
          >
            {char}
          </span>
        );
      })}
    </>
  );
}
