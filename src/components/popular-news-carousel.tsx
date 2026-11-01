"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "./ui/carousel";
import { SkeletonBlock } from "./skeleton-block";
import { usePopularNews } from "@/hooks/use-popular-news";
import { popularNewsSubtitle } from "@/lib/popular-news";
import { newsHeadline, newsCategoryTags } from "@/lib/news-presentation";
import { practiceDetailHref } from "@/lib/practice-entry";
import newsStyles from "./news-carousel.module.css";

export function PopularNewsCarousel({
  compact = false,
  returnTo,
}: {
  compact?: boolean;
  returnTo: string;
}) {
  const { data, loading, error, retry } = usePopularNews();
  const [carousel, setCarousel] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const items = data?.items ?? [];
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
    <section aria-label="인기 뉴스" className={compact ? "mt-7" : "pt-4 pb-3"}>
      <div className={compact ? "" : "px-5"}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] leading-6 font-bold">
            인기 뉴스 <span className="text-primary">TOP 10</span>
          </h2>
          <span
            aria-live="polite"
            className="text-xs tabular-nums text-[#6b7684]"
          >
            {items.length ? Math.min(selected + 1, items.length) : 0} /{" "}
            {items.length}
          </span>
        </div>
        <p className="mt-1 text-xs leading-4 text-[#8b95a1]">
          {popularNewsSubtitle(data, error)}
        </p>
      </div>
      <Carousel
        setApi={setCarousel}
        opts={{ align: "start", slidesToScroll: 1, containScroll: "trimSnaps" }}
        className={compact ? "mt-3" : "mt-3.5 pl-5"}
        aria-label="인기 뉴스 1위부터 10위까지"
      >
        <CarouselContent className="-ml-3">
          {loading && !data && (
            <CarouselItem
              className={compact ? "basis-full pl-3" : "basis-[312px] pl-3"}
            >
              <SkeletonBlock
                className={
                  compact ? "h-24 rounded-2xl" : "h-[184px] rounded-2xl"
                }
              />
            </CarouselItem>
          )}
          {items.map((item, index) => (
            <CarouselItem
              key={String(item.id)}
              className={compact ? "basis-full pl-3" : "basis-[312px] pl-3"}
            >
              <Link
                href={practiceDetailHref(item.id, returnTo)}
                aria-label={`인기 뉴스 ${item.rank}위: ${newsHeadline(item.title)}`}
                data-active={selected === index}
                className={
                  compact
                    ? "flex min-h-24 items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
                    : `${newsStyles.card} relative flex h-[184px] flex-col justify-between overflow-hidden rounded-[20px] p-5`
                }
              >
                <span
                  className={
                    compact
                      ? "shrink-0 text-2xl font-bold text-primary"
                      : `pointer-events-none absolute top-[82px] right-5 text-[72px] font-bold ${newsStyles.rank}`
                  }
                >
                  {item.rank}위
                </span>
                <div className="relative min-w-0 flex-1">
                  {!compact && (
                    <p
                      className={`${newsStyles.meta} mb-2 text-xs font-semibold`}
                    >
                      {Object.values(newsCategoryTags(item))
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <strong className="line-clamp-2 block text-[16px] leading-[22px] font-bold break-keep">
                    {newsHeadline(item.title)}
                  </strong>
                  <p
                    className={`${compact ? "text-[#8b95a1]" : newsStyles.meta} mt-2 text-xs`}
                  >
                    {data?.rankingBasis === "COMPLETED_USERS"
                      ? `${item.usageCount}명 연습 완료`
                      : "뉴스 목록 순서"}
                  </p>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {!loading && !error && !items.length && (
        <p role="status" className="px-5 py-5 text-sm text-[#8b95a1]">
          아직 공개된 뉴스가 없어요.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className={
            compact
              ? "mt-3 text-sm text-red-600"
              : "mx-5 mt-3 text-sm text-red-600"
          }
        >
          <p>{error}</p>
          <button
            type="button"
            className="min-h-11 font-semibold"
            onClick={retry}
          >
            인기 뉴스 다시 불러오기
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div
          className={`mt-2 flex items-center justify-between gap-2 ${compact ? "" : "px-5"}`}
        >
          <button
            type="button"
            aria-label="이전 순위 보기"
            disabled={!carousel || selected <= 0}
            onClick={() => carousel?.scrollPrev()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <div
            className="flex min-w-0 items-center"
            aria-label="인기 뉴스 순위 선택"
          >
            {items.map((item, index) => (
              <button
                key={String(item.id)}
                type="button"
                aria-label={`${item.rank}위 뉴스 보기`}
                aria-current={selected === index ? "true" : undefined}
                onClick={() => carousel?.scrollTo(index)}
                className="grid h-11 min-w-4 flex-1 place-items-center"
              >
                <span
                  className={`h-1.5 rounded-full ${selected === index ? "w-4 bg-primary" : "w-1.5 bg-[#d1d6db]"}`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="다음 순위 보기"
            disabled={!carousel || selected >= items.length - 1}
            onClick={() => carousel?.scrollNext()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
