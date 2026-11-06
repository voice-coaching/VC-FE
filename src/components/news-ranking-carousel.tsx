"use client";

import Link from "next/link";
import styles from "./news-ranking-carousel.module.css";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "./ui/carousel";
import { SkeletonBlock } from "./skeleton-block";
import { usePopularNews } from "@/hooks/use-popular-news";
import { newsHeadline } from "@/lib/news-presentation";
import { practiceDetailHref } from "@/lib/practice-entry";

const levels = { BEGINNER: "초급", INTERMEDIATE: "중급", ADVANCED: "고급" };
export function NewsRankingCarousel() {
  const { data, loading, error, retry } = usePopularNews();
  const items = data?.items.slice(0, 5) ?? [];
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
    <section
      aria-label="인기 뉴스"
      className="border-b-8 border-[#f2f4f6] pt-3 pb-6"
    >
      <div className="px-5 pb-4">
        <h2 className="text-xl leading-7 font-bold">
          인기 뉴스 <span className="text-[#6346f6]">TOP 5</span>
        </h2>
        <p className="mt-1 text-[13px] leading-[18px] font-medium text-[#8b95a1]">
          이번 주 가장 많이 연습한 뉴스예요
        </p>
      </div>
      <Carousel
        setApi={setCarousel}
        opts={{ align: "start", containScroll: false }}
        className="pl-5"
        aria-label="인기 뉴스 순위"
      >
        <CarouselContent className="-ml-2.5">
          {loading && !data ? (
            <CarouselItem className="basis-[242px] pl-2.5">
              <SkeletonBlock className="h-[164px] rounded-[20px]" />
            </CarouselItem>
          ) : null}
          {items.map((item, index) => (
            <CarouselItem key={item.id} className="basis-[242px] pl-2.5">
              <Link
                href={practiceDetailHref(item.id, "/news")}
                aria-label={`인기 뉴스 ${item.rank}위: ${newsHeadline(item.title)}`}
                data-active={selected === index}
                className={`${styles.card} flex h-[164px] flex-col rounded-[20px] p-[18px]`}
              >
                <span
                  className={`${styles.rank} flex items-baseline gap-0.5 font-bold`}
                >
                  <span className="text-[26px] leading-[31px]">
                    {item.rank}
                  </span>
                  <span className="text-[13px]">위</span>
                </span>
                <strong className="mt-2.5 line-clamp-2 text-base leading-[22px]">
                  {newsHeadline(item.title)}
                </strong>
                <span
                  className={`${styles.meta} mt-auto flex items-center gap-1.5 truncate text-xs leading-[17px]`}
                >
                  {levels[item.difficulty]}
                  <span className="opacity-40">|</span>
                  {item.publisher?.trim() &&
                  !/^speak(?:ai)?\s*학습\s*콘텐츠$/i.test(
                    item.publisher.trim(),
                  ) ? (
                    <>
                      {item.publisher.trim()}
                      <span className="opacity-40">|</span>
                    </>
                  ) : null}
                  {item.sentenceCount ? `${item.sentenceCount}문장` : null}
                </span>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {items.length > 0 && (
        <div
          className="mt-1 flex justify-center gap-1"
          aria-label="인기 뉴스 순위 선택"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`${item.rank}위 뉴스 보기`}
              aria-current={selected === index ? "true" : undefined}
              onClick={() => carousel?.scrollTo(index)}
              className="flex h-[26px] min-w-1.5 items-center justify-center"
            >
              <span
                className={`h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${selected === index ? "w-4 bg-[#6346f6]" : "w-1.5 bg-[#d1d6db]"}`}
              />
            </button>
          ))}
        </div>
      )}
      {!loading && !error && !items.length && (
        <p className="px-5 text-sm text-[#8b95a1]">
          아직 공개된 뉴스가 없어요.
        </p>
      )}
      {error && (
        <div role="alert" className="px-5 text-sm text-red-600">
          <p>{error}</p>
          <button onClick={retry} className="min-h-11 font-semibold">
            인기 뉴스 다시 불러오기
          </button>
        </div>
      )}
    </section>
  );
}
