"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
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
  return `content-${type}-${category || "all"}-${difficulty || "all"}`;
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
  const [category, setCategory] = useState("");
  const categoryValues = useRef<Record<string, string>>({});
  const fallbackCategories =
    type === "NEWS"
      ? ["사회", "경제", "문화", "스포츠"]
      : type === "SENTENCE"
        ? ["받침", "된소리", "자음", "모음"]
        : [];
  const [categories, setCategories] = useState(fallbackCategories);
  const [difficultyOptions, setDifficultyOptions] = useState(DIFFICULTIES);
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [difficultySheet, setDifficultySheet] = useState(false);
  const userId = getAuthenticatedUserId();
  const [initialCache] = useState(() =>
    readUserClientCache<CatalogCache>(
      userId,
      catalogCacheResource(type, "", ""),
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

  useEffect(() => {
    let active = true;
    const resource = cacheResources.contentFacets(type);
    const applyFacets = (facets: ContentFacets) => {
      categoryValues.current = {
        ...categoryValues.current,
        ...Object.fromEntries(
          facets.categories.map((option) => [option.label, option.value]),
        ),
      };
      if (facets.categories.length)
        setCategories(facets.categories.map((option) => option.label));
      if (facets.difficulties.length)
        setDifficultyOptions([
          DIFFICULTIES[0],
          ...facets.difficulties.map((option) => ({
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
        writeUserClientCache(userId, resource, facets);
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
    const cached = readUserClientCache<CatalogCache>(userId, resource);
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
    api.content
      .list({
        type,
        category: categoryValues.current[category] ?? (category || undefined),
        difficulty: difficulty || undefined,
        page: 0,
        size: 20,
      })
      .then((result) => {
        if (!active) return;
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
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, difficulty, type, userId]);

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const result = await api.content.list({
        type,
        category: categoryValues.current[category] ?? (category || undefined),
        difficulty: difficulty || undefined,
        page: page + 1,
        size: 20,
      });
      const nextItems = [...items, ...result.items];
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
      setError(
        reason instanceof Error
          ? reason.message
          : "콘텐츠를 더 불러오지 못했습니다.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const featured = items[0];

  return (
    <AppShell chromeColor="#f2f4f6" className="bg-[#f2f4f6]">
      <CatalogHeader title={title} />
      <p className="sr-only">{description}</p>

      {type === "NEWS" ? (
        <NewsIntro
          items={items.slice(0, 5)}
          category={category}
          categories={categories}
          onCategory={setCategory}
          returnTo={returnTo}
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
            type === "NEWS" ? "pt-8" : type === "ANNOUNCER" ? "pt-6" : "pt-7"
          }`}
        >
          <h2 className="text-[17px] leading-6 font-bold">
            {type === "NEWS" ? "전체 뉴스" : null}
            {type === "ANNOUNCER" ? "전체 멘트" : null}
            {type === "SENTENCE" ? (
              <>
                {category || "전체"} 문장
                <span className="ml-2 text-primary">{totalElements}</span>
              </>
            ) : null}
          </h2>
          {type === "NEWS" ? (
            <button
              type="button"
              onClick={() => setDifficultySheet(true)}
              className="flex h-8 items-center gap-1 rounded-full border border-[#e5e8eb] bg-white px-3 text-[13px] font-medium text-[#6b7684]"
            >
              {
                difficultyOptions.find((item) => item.value === difficulty)
                  ?.label
              }
              <ChevronDown className="size-4" />
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-[#8b95a1]">
            콘텐츠를 불러오는 중…
          </p>
        ) : error ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-[#fff0f2] p-4 text-sm text-[#d91b34]"
          >
            {error}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {items.map((item) => (
              <CatalogItem
                key={String(item.id)}
                item={item}
                type={type}
                href={practiceHref(item.id, returnTo)}
              />
            ))}
            {items.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#8b95a1]">
                조건에 맞는 콘텐츠가 없어요.
              </p>
            ) : null}
            {hasNext ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="mt-1 h-12 rounded-full border border-[#e5e8eb] bg-white text-sm font-bold disabled:opacity-50"
              >
                {loadingMore ? "불러오는 중…" : "더 보기"}
              </button>
            ) : null}
          </div>
        )}
      </section>

      {difficultySheet ? (
        <div
          className="fixed inset-0 z-50 mx-auto flex max-w-[402px] items-end bg-black/35"
          role="presentation"
          onClick={() => setDifficultySheet(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="difficulty-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full rounded-t-[28px] bg-white px-5 pt-5 pb-[max(28px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between">
              <h2 id="difficulty-title" className="text-lg font-bold">
                난이도
              </h2>
              <button
                type="button"
                onClick={() => setDifficultySheet(false)}
                aria-label="닫기"
                className="flex size-11 items-center justify-center"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-2">
              {difficultyOptions.map((option) => (
                <button
                  key={option.value || "all"}
                  type="button"
                  onClick={() => {
                    setDifficulty(option.value);
                    setDifficultySheet(false);
                  }}
                  className="flex min-h-14 w-full items-center justify-between border-b border-[#f2f4f6] text-left text-[15px] font-medium"
                >
                  {option.label}
                  {difficulty === option.value ? (
                    <Check className="size-5 text-primary" />
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function CatalogHeader({ title }: { title: string }) {
  return (
    <header className="relative flex h-12 items-center px-2 py-1">
      <Link
        href="/home"
        aria-label="뒤로가기"
        className="flex size-10 items-center justify-center"
      >
        <Image
          src="/figma/home/chevron-left.svg"
          alt=""
          width={24}
          height={24}
        />
      </Link>
      <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold">
        {title === "따라 읽기" ? "아나운서 따라 읽기" : title}
      </h1>
    </header>
  );
}

function NewsIntro({
  items,
  category,
  categories,
  onCategory,
  returnTo,
}: {
  items: PracticeContentSummary[];
  category: string;
  categories: string[];
  onCategory: (value: string) => void;
  returnTo: string;
}) {
  return (
    <>
      <nav className="flex gap-2 overflow-x-auto px-5 pt-3 pb-5">
        {["", ...categories].map((value) => (
          <button
            type="button"
            key={value || "all"}
            aria-pressed={category === value}
            onClick={() => onCategory(value)}
            className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium ${
              category === value
                ? "bg-primary text-white"
                : "bg-white text-[#4e5968]"
            }`}
          >
            {value || "전체"}
          </button>
        ))}
      </nav>

      <section>
        <div className="px-5">
          <h2 className="text-[17px] leading-6 font-bold">
            {new Date().getMonth() + 1}월 {Math.ceil(new Date().getDate() / 7)}
            주차{" "}
            <span className="text-primary">
              TOP {Math.min(5, items.length)}
            </span>
          </h2>
          <p className="mt-0.5 text-xs leading-4 text-[#8b95a1]">
            이번 주 가장 많이 연습한 뉴스예요
          </p>
        </div>
        <div className="mt-3 flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 pb-5">
          {items.map((item, index) => (
            <Link
              key={String(item.id)}
              href={practiceHref(item.id, returnTo)}
              className={`relative h-44 w-[260px] shrink-0 snap-start overflow-hidden rounded-[20px] p-[18px] ${
                index === 0
                  ? "bg-[linear-gradient(135deg,#2f6bff,#6f95ff)] text-white"
                  : "bg-white text-[#191f28]"
              }`}
            >
              <div className="flex gap-1.5">
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                    index === 0
                      ? "bg-white/20 text-white"
                      : difficultyStyle[item.difficulty]
                  }`}
                >
                  {difficultyLabel[item.difficulty]}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${index === 0 ? "bg-white/20" : "bg-[#f2f4f6] text-[#6b7684]"}`}
                >
                  {categoryLabel(item.category)}
                </span>
              </div>
              <strong className="mt-2 block max-w-[190px] text-base leading-6">
                {item.title}
              </strong>
              <span
                className={`absolute bottom-[18px] left-[18px] text-xs ${index === 0 ? "text-white/80" : "text-[#8b95a1]"}`}
              >
                {categoryLabel(item.category)} · 약{" "}
                {Math.max(1, Math.ceil(item.estimatedSeconds / 60))}분
              </span>
              <span
                aria-hidden="true"
                className={`absolute right-4 bottom-[-9px] text-[76px] leading-none font-bold ${index === 0 ? "text-white/20" : "text-[#edf2ff]"}`}
              >
                {index + 1}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
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
          {categoryLabel(item.category)} ·{" "}
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

  return (
    <Link
      href={href}
      className="flex min-h-[116px] items-center rounded-2xl bg-white p-4 shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[11px] leading-[14px] font-bold ${difficultyStyle[item.difficulty]}`}
          >
            {difficultyLabel[item.difficulty]}
          </span>
          <span className="text-xs text-[#8b95a1]">
            {categoryLabel(item.category)}
          </span>
        </span>
        <strong className="mt-2.5 block truncate text-base leading-6">
          {item.title}
        </strong>
        <span className="mt-2 block text-[13px] leading-[18px] text-[#8b95a1]">
          {categoryLabel(item.category)} · 약{" "}
          {Math.max(1, Math.ceil(item.estimatedSeconds / 60))}분
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
