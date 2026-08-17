"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import {
  api,
  type ContentType,
  type Difficulty,
  type PracticeContentSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

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
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [items, setItems] = useState<PracticeContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.content
      .list({ type, difficulty: difficulty || undefined, page: 0, size: 20 })
      .then((result) => {
        if (active) setItems(result.items);
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
  }, [difficulty, type]);

  return (
    <AppShell>
      <TopBar to="/home" title={title} />
      <div className="px-5 pb-10">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {DIFFICULTIES.map((option) => (
            <button
              key={option.value || "all"}
              onClick={() => setDifficulty(option.value)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-semibold",
                difficulty === option.value
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
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
                href={`/practice/${item.id}`}
                className="rounded-3xl border border-border p-5 transition-colors hover:bg-surface"
              >
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {item.contentType} · {item.category}
                  </span>
                  <span>
                    {difficultyLabel[item.difficulty]} · 약{" "}
                    {Math.max(1, Math.ceil(item.estimatedSeconds / 60))}분
                  </span>
                </div>
                <p className="mt-2 text-[16px] leading-relaxed font-semibold">
                  {item.title}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {item.category} · 약{" "}
                  {Math.max(1, Math.ceil(item.estimatedSeconds / 60))}분
                </p>
              </Link>
            ))}
            {items.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                조건에 맞는 콘텐츠가 없습니다.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
