"use client";

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
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.myPage
      .listTrainingSessions({
        type: kind,
        status: "COMPLETED",
        page: 0,
        size: 50,
      })
      .then((value) => {
        if (active) setItems(value.items);
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
              <div
                key={String(item.sessionId)}
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
