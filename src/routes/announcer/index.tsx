"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { api, type PracticeContentSummary } from "@/lib/api";

const FIGMA_ITEMS = [
  { title: "아침 뉴스 오프닝 멘트", sentenceCount: 3, seconds: 42 },
  { title: "날씨 예보 전달하기", sentenceCount: 4, seconds: 65 },
  { title: "경제 브리핑 리드 문장", sentenceCount: 5, seconds: 88 },
  { title: "스포츠 하이라이트 소개", sentenceCount: 4, seconds: 72 },
  { title: "특집 다큐 내레이션 도입부", sentenceCount: 6, seconds: 123 },
  { title: "클로징 인사 멘트", sentenceCount: 3, seconds: 38 },
] as const;

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function AnnouncerCard({
  title,
  sentenceCount,
  seconds,
  href,
}: {
  title: string;
  sentenceCount: number;
  seconds: number;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e2e9ff]">
        <Image
          src="/figma/home/follow.svg"
          alt=""
          width={14}
          height={32}
          aria-hidden="true"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] leading-6 font-bold tracking-[0.01em] text-[#191f28]">
          {title}
        </span>
        <span className="mt-1.5 flex items-center gap-[7px] text-[13px] leading-[18px] tracking-[0.019em] text-[#8b95a1]">
          <span>{sentenceCount}문장</span>
          <span className="h-2.5 w-px bg-[#e5e8eb]" aria-hidden="true" />
          <span>{formatDuration(seconds)}</span>
        </span>
      </span>

      <Image
        src="/figma/auth/chevron-right.svg"
        alt=""
        width={20}
        height={20}
        className="size-5 shrink-0"
        aria-hidden="true"
      />
    </>
  );

  const className =
    "flex w-full touch-manipulation items-center gap-3.5 overflow-hidden rounded-2xl bg-white p-4 text-left shadow-[0_2px_6px_rgba(23,23,23,0.05)] transition-[transform,opacity] duration-150 active:scale-[0.985] active:opacity-80";

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link
      href={href}
      className={className}
      aria-label={`${title}, ${sentenceCount}문장, ${formatDuration(seconds)}`}
    >
      {content}
    </Link>
  );
}

export default function AnnouncerPage() {
  const [apiItems, setApiItems] = useState<PracticeContentSummary[]>([]);

  useEffect(() => {
    let active = true;

    api.content
      .list({ type: "ANNOUNCER", page: 0, size: 20 })
      .then((result) => {
        if (active) setApiItems(result.items);
      })
      .catch(() => {
        // The Figma sample list remains visible while the API is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(() => {
    if (apiItems.length === 0) {
      return FIGMA_ITEMS.map((item) => ({ ...item, contentId: undefined }));
    }

    return apiItems.map((item, index) => {
      const fallback = FIGMA_ITEMS[index % FIGMA_ITEMS.length];
      return {
        title: item.title,
        sentenceCount: fallback.sentenceCount,
        seconds: item.estimatedSeconds,
        contentId: item.id,
      };
    });
  }, [apiItems]);

  return (
    <IPhoneFrame>
      <section className="flex h-full flex-col bg-[#fafbfc]">
        <div className="h-11 shrink-0" aria-hidden="true" />

        <header className="flex h-12 shrink-0 items-center px-2 py-1">
          <Link
            href="/home"
            aria-label="홈으로 돌아가기"
            className="flex size-10 touch-manipulation items-center justify-center transition-opacity active:opacity-50"
          >
            <NavigationIcon />
          </Link>
          <span className="flex-1" aria-hidden="true" />
          <h1 className="shrink-0 text-[17px] leading-6 font-bold text-[#191f28]">
            아나운서 따라 읽기
          </h1>
          <span className="flex-1" aria-hidden="true" />
          <span className="size-10 shrink-0" aria-hidden="true" />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
            {cards.map((item, index) => (
              <AnnouncerCard
                key={item.contentId ?? `${item.title}-${index}`}
                title={item.title}
                sentenceCount={item.sentenceCount}
                seconds={item.seconds}
                href={
                  index === 0
                    ? "/announcer/morning-news?preview=1"
                    : item.contentId
                      ? `/practice/${item.contentId}?returnTo=${encodeURIComponent("/announcer")}`
                      : undefined
                }
              />
            ))}
          </div>
        </div>
      </section>
    </IPhoneFrame>
  );
}
