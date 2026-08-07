"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { scoreColor } from "@/lib/app-data";
import { api, type ContentKind, type LearningHistoryItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ value?: ContentKind; label: string }> = [
  { label: "전체" },
  { value: "news", label: "뉴스" },
  { value: "sentence", label: "문장" },
  { value: "announcer", label: "따라 읽기" },
  { value: "pronunciation", label: "발음" },
  { value: "intonation", label: "억양" },
];

export default function LearningHistory() {
  const [kind, setKind] = useState<ContentKind | undefined>();
  const [items, setItems] = useState<LearningHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.myPage
      .listHistory({ kind })
      .then((value) => {
        if (active) setItems(value);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind]);
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
                kind === filter.value ? "bg-foreground text-background" : "bg-surface",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">기록을 불러오는 중…</p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(item.completedAt).toLocaleDateString("ko-KR")} · {item.minutes}분
                  </p>
                </div>
                <b className={scoreColor(item.score)}>{item.score}</b>
              </div>
            ))}
            {items.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                아직 저장된 학습 기록이 없습니다.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
