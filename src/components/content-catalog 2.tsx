"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import {
  api,
  type ContentType,
  type Difficulty,
  type PracticeContentSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/content-labels";

const DIFFICULTIES: Array<{ value: Difficulty | ""; label: string }> = [
  { value: "", label: "전체" },
  { value: "BEGINNER", label: "초급" },
  { value: "INTERMEDIATE", label: "중급" },
  { value: "ADVANCED", label: "고급" },
];

const difficultyLabel: Record<Difficulty, string> = {
  BEGINNER: "초급",
  INTERMEDIATE: "중급",
  ADVANCED: "고급",
};

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
  const categories =
    type === "NEWS"
      ? ["사회", "경제", "문화", "스포츠"]
      : type === "SENTENCE"
        ? ["받침", "된소리", "자음", "모음"]
        : [];
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [items, setItems] = useState<PracticeContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setLoadMoreError(null);
    api.content
      .list({
        type,
        category: categoryValues.current[category] ?? (category || undefined),
        difficulty: difficulty || undefined,
        page: 0,
        size: 20,
      })
      .then((result) => {
        if (active) {
          setItems(result.items);
          if (!category)
            categoryValues.current = Object.fromEntries(
              result.items.map((item) => [
                categoryLabel(item.category),
                item.category,
              ]),
            );
          setPage(result.page);
          setHasNext(Boolean(result.hasNext));
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "콘텐츠를 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, difficulty, type]);

  async function loadMore() {
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
      setItems((current) => [...current, ...result.items]);
      setPage(result.page);
      setHasNext(Boolean(result.hasNext));
    } catch (reason) {
      setLoadMoreError(
        reason instanceof Error
          ? reason.message
          : "콘텐츠를 더 불러오지 못했습니다.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AppShell nav={false}>
      <TopBar to="/home" title={title} />
      <div className="px-5 pb-10">
        <p className="sr-only">{description}</p>
        {categories.length > 0 && (
          <div
            className="mb-4 flex gap-2 overflow-x-auto py-1"
            aria-label="카테고리"
          >
            {["", ...categories].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-2 text-sm",
                  category === value
                    ? "bg-primary text-white"
                    : "bg-[#f2f4f6] text-[#6b7684]",
                )}
              >
                {value || "전체"}
              </button>
            ))}
          </div>
        )}
        {type === "NEWS" && (
          <div
            className="mb-4 flex gap-2 overflow-x-auto pb-1"
            aria-label="난이도"
          >
            {DIFFICULTIES.map((option) => (
              <button
                key={option.value || "all"}
                onClick={() => setDifficulty(option.value)}
                aria-pressed={difficulty === option.value}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-xs font-semibold",
                  difficulty === option.value
                    ? "bg-primary/10 text-primary"
                    : "bg-surface text-muted-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {loading && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            콘텐츠를 불러오는 중…
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {!loading && !error && (
          <div className="mt-5 flex flex-col gap-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/practice/${item.id}?returnTo=${encodeURIComponent(returnTo)}`}
                className="design-card relative pr-10 transition-shadow hover:shadow-md"
              >
                {type === "ANNOUNCER" ? (
                  <div className="flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e3e9ff]">
                      <Image
                        src="/figma/home/follow.svg"
                        alt=""
                        width={15}
                        height={34}
                      />
                    </span>
                    <div>
                      <p className="text-base font-bold">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        약{" "}
                        {Math.floor(item.estimatedSeconds / 60)
                          .toString()
                          .padStart(2, "0")}
                        :
                        {(item.estimatedSeconds % 60)
                          .toString()
                          .padStart(2, "0")}
                      </p>
                    </div>
                    <ChevronRight className="absolute right-4 size-4 text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        <span
                          className={cn(
                            "mr-2 rounded px-2 py-1",
                            item.difficulty === "BEGINNER"
                              ? "bg-emerald-50 text-emerald-700"
                              : item.difficulty === "ADVANCED"
                                ? "bg-[#ffebe5] text-[#ef7157]"
                                : "bg-[#edf2ff] text-primary",
                          )}
                        >
                          {difficultyLabel[item.difficulty]}
                        </span>
                        {categoryLabel(item.category)}
                      </span>
                      <ChevronRight className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <p className="mt-2 text-[16px] leading-relaxed font-semibold">
                      {item.title}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {type === "SENTENCE"
                        ? `${(item.title.match(/[가-힣]/g) ?? []).length}음절`
                        : `${categoryLabel(item.category)} · 약 ${Math.max(1, Math.ceil(item.estimatedSeconds / 60))}분`}
                    </p>
                  </>
                )}
              </Link>
            ))}
            {items.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                조건에 맞는 콘텐츠가 없습니다.
              </p>
            )}
            {hasNext && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="mt-2 rounded-full border border-border py-3 text-sm font-semibold disabled:opacity-50"
              >
                {loadingMore ? "불러오는 중…" : "콘텐츠 더 보기"}
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
