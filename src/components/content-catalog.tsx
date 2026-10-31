"use client";

import newsStyles from "./news-carousel.module.css";
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
  type ContentType,
  type Difficulty,
  type PracticeContentSummary,
} from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import { readUserClientCache, writeUserClientCache } from "@/lib/client-cache";
import { categoryLabel } from "@/lib/content-labels";
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

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

const difficultyStyle: Record<Difficulty, string> = {
  BEGINNER: "bg-[#e7f8f1] text-[#00a878]",
  INTERMEDIATE: "bg-[#edf2ff] text-[#2f6bff]",
  ADVANCED: "bg-[#fff0f2] text-[#ff4d62]",
};

const SENTENCE_FILTERS = [
  { label: "받침", symbol: "ㄹ", description: "끝소리를 또렷하게" },
  { label: "된소리", symbol: "ㄲ", description: "힘주어 정확하게" },
  { label: "자음", symbol: "ㄹ", description: "첫소리를 분명하게" },
  { label: "모음", symbol: "ㅏ", description: "입모양을 정확하게" },
];

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
  return `content-${type === "NEWS" ? "NEWS-topics-v1" : type}-${category || "all"}-${difficulty || "all"}`;
}

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function practiceHref(id: PracticeContentSummary["id"], returnTo: string) {
  const params = new URLSearchParams({ returnTo, start: "1" });
  return `/practice/${id}?${params.toString()}`;
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
  const { category, difficulty, setCategory, setDifficulty } =
    useCatalogFilters(`${userId}:${type}`);
  const categoryValues = useRef<Record<string, string>>({});
  const fallbackCategories =
    type === "NEWS"
      ? []
      : type === "SENTENCE"
        ? ["받침", "된소리", "자음", "모음"]
        : [];
  const [categories, setCategories] = useState(fallbackCategories);
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
  const [topItems, setTopItems] = useState<PracticeContentSummary[]>([]);
  const [topLoading, setTopLoading] = useState(type === "NEWS");
  const [topError, setTopError] = useState(false);
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
    if (type !== "NEWS") return;
    let active = true;
    const resource = "news-top-all";
    const cached = readUserClientCache<PracticeContentSummary[]>(
      userId,
      resource,
    );
    setTopItems(cached ?? []);
    setTopLoading(!cached);
    setTopError(false);
    api.content
      .list({
        type: "NEWS",

        page: 0,
        size: 5,
      })
      .then((result) => {
        if (!active) return;
        setTopItems(result.items);
        writeUserClientCache(userId, resource, result.items);
      })
      .catch(() => {
        if (active && !cached) setTopError(true);
      })
      .finally(() => {
        if (active) setTopLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type, userId, retry]);

  useEffect(() => {
    let active = true;
    const resource = cacheResources.contentFacets(type);
    const applyFacets = (facets: ContentFacets) => {
      const visibleFacets = catalogFacetsForPractice(type, facets);
      categoryValues.current = {
        ...categoryValues.current,
        ...Object.fromEntries(
          visibleFacets.categories.map((option) => [
            option.label,
            option.value,
          ]),
        ),
      };
      if (type !== "NEWS" && visibleFacets.categories.length)
        setCategories(visibleFacets.categories.map((option) => option.label));
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
    if (cached) applyFacets(cached);
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
        // Keep the bundled labels when the optional facet endpoint is unavailable.
      });
    return () => {
      active = false;
    };
  }, [type, userId]);

  useEffect(() => {
    let active = true;
    const resource = catalogCacheResource(type, category, difficulty);
    generation.current += 1;
    loadMoreBusy.current = false;
    setLoadingMore(false);
    setLoadMoreError(null);
    setRefreshing(true);
    const cached = readUserClientCache<CatalogCache>(userId, resource);
    setLoadedScope(scope);
    if (cached) {
      setItems(cached.items);
      setTotalElements(cached.totalElements);
      setPage(cached.page);
      setHasNext(cached.hasNext);
      if (!category) {
        categoryValues.current = {
          ...categoryValues.current,
          ...Object.fromEntries(
            cached.items.map((item) => [
              categoryLabel(item.category),
              item.category,
            ]),
          ),
        };
      }
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
      setCategories([
        ...new Set(
          news.flatMap((item) => {
            const tags = newsCategoryTags(item);
            return [tags.category, ...(tags.topic ? [tags.topic] : [])];
          }),
        ),
      ]);
      const filtered = news.filter((item) => {
        const tags = newsCategoryTags(item);
        return (
          (!category ||
            tags.category === category ||
            tags.topic === category) &&
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
              category:
                categoryValues.current[category] ?? (category || undefined),
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
        if (!category) {
          categoryValues.current = {
            ...categoryValues.current,
            ...Object.fromEntries(
              result.items.map((item) => [
                categoryLabel(item.category),
                item.category,
              ]),
            ),
          };
        }
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
  }, [category, difficulty, type, userId, retry, scope]);

  async function loadMore() {
    if (loadMoreBusy.current || refreshing || !hasNext) return;
    loadMoreBusy.current = true;
    const requestGeneration = generation.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await api.content.list({
        type,
        category: categoryValues.current[category] ?? (category || undefined),
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
  const featured = visibleItems[0];

  return (
    <AppShell
      mainRef={scrollRef}
      chromeColor="#f2f4f6"
      className="bg-[#f2f4f6]"
    >
      <CatalogHeader title={title} />
      <p className="sr-only">{description}</p>

      {type === "NEWS" ? (
        <NewsIntro loading={topLoading} items={topItems} returnTo={returnTo} />
      ) : null}

      {type === "NEWS" && topError ? (
        <button
          type="button"
          className="mx-5 min-h-11 text-sm text-primary"
          onClick={() => setRetry((value) => value + 1)}
        >
          TOP 뉴스를 불러오지 못했어요. 다시 시도
        </button>
      ) : null}

      {type === "NEWS" ? (
        <NewsFilterBar
          category={category}
          categories={categories}
          onCategory={setCategory}
        />
      ) : null}

      {type === "SENTENCE" ? (
        <SentenceFilters category={category} onCategory={setCategory} />
      ) : null}

      {type === "ANNOUNCER" && featured ? (
        <AnnouncerHero item={featured} returnTo={returnTo} />
      ) : null}

      <section className="px-5 pb-8">
        <div
          className={`flex items-center justify-between ${
            type === "NEWS" ? "pt-4" : type === "ANNOUNCER" ? "pt-6" : "pt-7"
          }`}
        >
          <h2 className="text-[17px] leading-6 font-bold">
            {type === "NEWS" ? (
              <>
                {category || "전체"} 뉴스
                {!loading ? (
                  <span className="ml-1.5 text-primary">
                    {visibleTotalElements}
                  </span>
                ) : null}
              </>
            ) : null}
            {type === "ANNOUNCER" ? "전체 멘트" : null}
            {type === "SENTENCE" ? (
              <>
                {category || "전체"} 문장
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

        {loading ? (
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
          <div className="mt-3 flex flex-col gap-3">
            <div
              className={
                type === "NEWS"
                  ? "rounded-[20px] bg-white px-4 py-1"
                  : "flex flex-col gap-3"
              }
            >
              {visibleItems.map((item) => (
                <CatalogItem
                  key={String(item.id)}
                  item={item}
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

function NewsIntro({
  loading,
  items,
  returnTo,
}: {
  loading: boolean;
  items: PracticeContentSummary[];
  returnTo: string;
}) {
  const [carousel, setCarousel] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!carousel) return;
    const sync = () => setSelected(carousel.selectedScrollSnap());
    sync();
    carousel.on("select", sync);
    carousel.on("reInit", sync);
    return () => {
      carousel.off("select", sync);
      carousel.off("reInit", sync);
    };
  }, [carousel]);
  return (
    <>
      <section className="pt-4 pb-3" aria-label="인기 뉴스">
        <div className="px-5">
          <h2 className="text-[17px] leading-6 font-bold">
            {new Date().getMonth() + 1}월 {Math.ceil(new Date().getDate() / 7)}
            주차{" "}
            <span className="text-primary">
              TOP {loading ? 5 : Math.min(5, items.length)}
            </span>
          </h2>
          <p className="mt-1 text-xs leading-4 font-medium text-[#8b95a1]">
            이번 주 가장 많이 연습한 뉴스예요
          </p>
        </div>
        <Carousel
          setApi={setCarousel}
          className="mt-3.5 pl-5"
          opts={{ align: "start", containScroll: false, slidesToScroll: 1 }}
          aria-label="TOP 뉴스"
        >
          <CarouselContent className="-ml-3">
            {loading && (
              <CarouselItem className="basis-[312px] pl-3">
                <NewsTopSkeleton />
              </CarouselItem>
            )}
            {items.slice(0, 5).map((item, index) => (
              <CarouselItem
                key={String(item.id)}
                className="basis-[312px] pl-3"
              >
                <Link
                  href={practiceHref(item.id, returnTo)}
                  data-active={selected === index}
                  className={`${newsStyles.card} relative flex h-[184px] flex-col justify-between overflow-hidden rounded-[20px] p-5`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute top-[88px] right-5 text-[100px] leading-none font-bold tracking-[-2.82px] ${newsStyles.rank}`}
                  >
                    {index + 1}
                  </span>
                  <div className="relative">
                    <div className="flex flex-wrap gap-1.5 text-[11px] leading-[14px] font-bold">
                      <span
                        className={`rounded-full px-2 py-[3px] ${newsStyles.chip} ${difficultyStyle[item.difficulty]}`}
                      >
                        {difficultyLabel[item.difficulty]}
                      </span>
                      {Object.values(newsCategoryTags(item))
                        .filter((tag): tag is string => Boolean(tag))
                        .map((tag) => (
                          <span
                            key={tag}
                            className={`rounded-full px-2 py-[3px] ${newsStyles.chip} bg-[#f2f4f6] text-[#4e5968]`}
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                    <strong className="mt-2 line-clamp-3 block text-[18px] leading-[22px] break-keep">
                      {newsHeadline(item.title)}
                    </strong>
                  </div>
                  <span
                    className={`relative text-xs leading-4 font-medium ${newsStyles.meta}`}
                  >
                    {newsMetadata(item).join("  |  ")}
                  </span>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {!loading && items.length > 1 && (
          <div
            className="mt-3.5 flex h-1.5 items-center justify-center gap-1"
            aria-label="인기 뉴스 페이지"
          >
            {items.slice(0, 5).map((item, index) => (
              <button
                key={String(item.id)}
                type="button"
                aria-label={`인기 뉴스 ${index + 1}번 보기`}
                aria-current={selected === index ? "true" : undefined}
                onClick={() => carousel?.scrollTo(index)}
                className={`${newsStyles.dot} relative h-1.5 rounded-full before:absolute before:-inset-y-3 before:inset-x-0 ${selected === index ? "w-4 bg-primary" : "w-1.5 bg-[#d1d6db]"}`}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// Give topic filters the full width; difficulty belongs beside the list heading.
function NewsFilterBar({
  category,
  categories,
  onCategory,
}: {
  category: string;
  categories: string[];
  onCategory: (value: string) => void;
}) {
  return (
    <div className="sticky top-0 z-10 mt-3 flex items-center bg-[#f2f4f6] py-2">
      <nav
        aria-label="뉴스 카테고리"
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none]"
      >
        {["", ...categories].map((value) => (
          <button
            key={value || "all"}
            type="button"
            aria-pressed={category === value}
            onClick={() => onCategory(value)}
            className={`h-9 shrink-0 rounded-full px-4 text-[14px] leading-5 font-medium before:absolute before:-inset-y-1 before:inset-x-0 relative ${category === value ? "bg-[#191f28] font-bold text-white" : "bg-white text-[#4e5968]"}`}
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
      : `약 ${Math.max(1, Math.ceil(item.estimatedSeconds / 60))}분`,
  ].filter((value): value is string => Boolean(value));
}

// One accent per row: the category tile carries the color, everything else stays neutral.
const newsCategoryTile: Record<
  string,
  { icon: string; color: string; tint: string }
> = {
  사회: { icon: "society", color: "#2f6bff", tint: "#edf2ff" },
  경제: { icon: "economy", color: "#00a878", tint: "#e7f8f1" },
  문화: { icon: "culture", color: "#8b5cf6", tint: "#f3eeff" },
  스포츠: { icon: "sports", color: "#ff8a00", tint: "#fff4e5" },
};

const difficultyLevel: Record<Difficulty, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

function NewsCategoryTile({ item }: { item: PracticeContentSummary }) {
  const label = categoryLabel(item.category);
  const tile = newsCategoryTile[label];
  return (
    <span
      role="img"
      aria-label={label || "뉴스"}
      className="flex size-12 shrink-0 items-center justify-center rounded-[14px]"
      style={{ backgroundColor: tile?.tint ?? "#f2f4f6" }}
    >
      {tile ? (
        <span
          aria-hidden="true"
          className="size-[22px]"
          style={{
            backgroundColor: tile.color,
            mask: `url(/figma/news-improved/${tile.icon}.svg) center / contain no-repeat`,
            WebkitMask: `url(/figma/news-improved/${tile.icon}.svg) center / contain no-repeat`,
          }}
        />
      ) : (
        <span className="text-[13px] font-bold text-[#8b95a1]">뉴스</span>
      )}
    </span>
  );
}

function DifficultyMeter({ difficulty }: { difficulty: Difficulty }) {
  const level = difficultyLevel[difficulty];
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-[#4e5968]">
      <span aria-hidden="true" className="flex items-end gap-[2px]">
        {[6, 9, 12].map((height, index) => (
          <span
            key={height}
            className={`w-[3px] rounded-full ${index < level ? "bg-[#4e5968]" : "bg-[#d1d6db]"}`}
            style={{ height }}
          />
        ))}
      </span>
      {difficultyLabel[difficulty]}
    </span>
  );
}

function SentenceFilters({
  category,
  onCategory,
}: {
  category: string;
  onCategory: (value: string) => void;
}) {
  return (
    <section className="px-5 pt-3">
      <h2 className="text-[17px] leading-6 font-bold">
        연습할 소리를 골라보세요
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {SENTENCE_FILTERS.map((item) => {
          const selected = category === item.label;
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={selected}
              onClick={() => onCategory(selected ? "" : item.label)}
              className={`flex h-[72px] items-center gap-3 rounded-2xl bg-white px-4 text-left shadow-[0_2px_6px_rgba(23,23,23,0.05)] ${selected ? "border-2 border-primary" : "border-2 border-transparent"}`}
            >
              <span className="w-8 shrink-0 text-center text-[34px] leading-9 font-black text-primary">
                {item.symbol}
              </span>
              <span className="min-w-0">
                <strong className="block text-[15px] leading-[22px]">
                  {item.label}
                </strong>
                <span className="block truncate text-xs leading-4 text-[#8b95a1]">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AnnouncerHero({
  item,
  returnTo,
}: {
  item: PracticeContentSummary;
  returnTo: string;
}) {
  return (
    <section className="px-5 pt-3">
      <h2 className="text-[17px] leading-6 font-bold">오늘의 아나운서 멘트</h2>
      <p className="mt-1 text-xs leading-4 font-medium text-[#8b95a1]">
        매일 한 문장씩 아나운서처럼 읽어봐요
      </p>
      <div className="relative mt-3 h-60 overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,#2f6bff,#5b8cff)] p-5 text-white">
        <Image
          src="/figma/catalog/announcer-character.png"
          alt="아나운서 Speak AI 캐릭터"
          width={170}
          height={170}
          className="absolute right-2 bottom-[-28px] size-[170px] object-contain"
        />
        <span className="inline-flex rounded-full bg-white/20 px-2 py-[3px] text-[11px] leading-[14px] font-bold">
          {new Intl.DateTimeFormat("ko-KR", {
            month: "long",
            day: "numeric",
          }).format(new Date())}
        </span>
        <h3 className="mt-2 max-w-[230px] text-xl leading-7 font-bold">
          {item.title}
        </h3>
        <p className="mt-2 text-xs leading-4 font-medium text-white/80">
          {categoryLabel(item.category)}
          <span aria-hidden="true" className="mx-1.5 text-white/40">
            |
          </span>
          {durationLabel(item.estimatedSeconds)}
        </p>
        <Link
          href={practiceHref(item.id, returnTo)}
          className="absolute bottom-5 left-5 flex h-10 items-center gap-1.5 rounded-full bg-white pr-[18px] pl-[14px] text-sm font-bold text-primary"
        >
          <Image
            src="/figma/catalog/play-blue.svg"
            alt=""
            width={14}
            height={14}
          />
          먼저 들어보기
        </Link>
      </div>
    </section>
  );
}

function CatalogItem({
  item,
  type,
  href,
}: {
  item: PracticeContentSummary;
  type: ContentType;
  href: string;
}) {
  if (type === "ANNOUNCER") {
    return (
      <Link
        href={href}
        className="flex min-h-20 items-center gap-3.5 rounded-2xl bg-white p-4 shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#e2e9ff]">
          <Image
            src="/figma/catalog/announcer-mic.svg"
            alt=""
            width={14}
            height={32}
          />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-base leading-6">
            {item.title}
          </strong>
          <span className="mt-1.5 block text-[13px] leading-[18px] text-[#8b95a1]">
            {durationLabel(item.estimatedSeconds)}
          </span>
        </span>
        <Image
          src="/figma/catalog/chevron-right.svg"
          alt=""
          width={20}
          height={20}
        />
      </Link>
    );
  }

  if (type === "SENTENCE") {
    return (
      <Link
        href={href}
        className="flex min-h-[78px] items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
      >
        <strong className="min-w-0 flex-1 text-[16px] leading-6 font-medium">
          {item.title}
        </strong>
        <Image
          src="/figma/catalog/chevron-right.svg"
          alt=""
          width={20}
          height={20}
        />
      </Link>
    );
  }

  const { category, topic } = newsCategoryTags(item);
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 border-t border-[#f2f4f6] py-4 first:border-t-0 active:opacity-70"
    >
      <NewsCategoryTile item={item} />
      <span className="min-w-0 flex-1">
        <strong className="line-clamp-2 block text-[16px] leading-[22px] font-bold break-keep text-[#191f28]">
          {newsHeadline(item.title)}
        </strong>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-[#8b95a1]">
          <DifficultyMeter difficulty={item.difficulty} />
          {[topic ?? category, ...newsMetadata(item)].map((value, index) => (
            <span key={index} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-2.5 w-px bg-[#e5e8eb]" />
              {value}
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}

function NewsTopSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-[184px] w-[300px] rounded-[20px] bg-white p-5"
    >
      <div className="flex gap-1.5">
        <SkeletonBlock className="h-5 w-10" />
        <SkeletonBlock className="h-5 w-12" />
      </div>
      <SkeletonBlock className="mt-3 h-5 w-[180px]" />
      <SkeletonBlock className="mt-2 h-5 w-[120px]" />
      <SkeletonBlock className="mt-10 h-3.5 w-20" />
    </div>
  );
}

function CatalogListSkeleton({ type }: { type: ContentType }) {
  return (
    <div role="status" aria-busy="true" className="mt-3 flex flex-col gap-3">
      <span className="sr-only">콘텐츠를 불러오는 중</span>
      {[0, 1, 2, 3].map((index) =>
        type === "ANNOUNCER" ? (
          <div
            key={index}
            className="flex min-h-20 items-center gap-3.5 rounded-2xl bg-white p-4"
          >
            <SkeletonBlock className="size-12 shrink-0" />
            <div className="flex-1">
              <SkeletonBlock className="h-4 w-3/5" />
              <SkeletonBlock className="mt-2.5 h-3 w-14" />
            </div>
          </div>
        ) : type === "SENTENCE" ? (
          <div
            key={index}
            className="flex min-h-[78px] items-center rounded-2xl bg-white px-4 py-3"
          >
            <SkeletonBlock className="h-4 w-4/5" />
          </div>
        ) : (
          <div
            key={index}
            className="flex items-center gap-3.5 rounded-2xl bg-white p-4"
          >
            <SkeletonBlock className="size-12 shrink-0 rounded-[14px]" />
            <div className="flex-1">
              <SkeletonBlock className="h-4 w-3/5" />
              <SkeletonBlock className="mt-2.5 h-3 w-32" />
            </div>
          </div>
        ),
      )}
    </div>
  );
}
