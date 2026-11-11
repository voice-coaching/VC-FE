"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./home-popular-news.module.css";
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

export function HomePopularNews() {
  const { data, loading, error, retry } = usePopularNews();
  const items = data?.items ?? [];
  const [carousel, setCarousel] = useState<CarouselApi>();
  const container = useRef<HTMLDivElement>(null);
  const interacting = useRef(false);
  useEffect(() => {
    if (!carousel || items.length < 2) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval>;
    const advance = () => {
      if (
        motion.matches ||
        document.hidden ||
        interacting.current ||
        container.current?.matches(":hover") ||
        container.current?.contains(document.activeElement)
      )
        return;
      if (carousel.canScrollNext()) carousel.scrollNext();
      else carousel.scrollTo(0);
    };
    const restart = () => {
      clearInterval(timer);
      timer = setInterval(advance, 4000);
    };
    const down = () => {
      interacting.current = true;
    };
    const up = () => {
      interacting.current = false;
      restart();
    };
    restart();
    carousel.on("pointerDown", down);
    carousel.on("pointerUp", up);
    document.addEventListener("visibilitychange", restart);
    return () => {
      clearInterval(timer);
      carousel.off("pointerDown", down);
      carousel.off("pointerUp", up);
      document.removeEventListener("visibilitychange", restart);
    };
  }, [carousel, items.length]);
  // Tie each row's fade/scale to the live scroll position so the outgoing
  // headline dissolves while the next one rises in, instead of a hard slide.
  useEffect(() => {
    if (!carousel) return;
    const apply = () => {
      const engine = carousel.internalEngine();
      const snaps = carousel.scrollSnapList();
      const step = snaps.length > 1 ? snaps[1] - snaps[0] : 1;
      const progress = carousel.scrollProgress();
      const slides = carousel.slideNodes();
      snaps.forEach((snap, index) => {
        let diff = snap - progress;
        if (engine.options.loop) {
          for (const point of engine.slideLooper.loopPoints) {
            const target = point.target();
            if (point.index === index && target !== 0) {
              diff =
                Math.sign(target) < 0
                  ? snap - (1 + progress)
                  : snap + (1 - progress);
            }
          }
        }
        const active = Math.max(0, 1 - Math.abs(diff) / step);
        slides[index]?.style.setProperty("--active", active.toFixed(3));
      });
    };
    apply();
    carousel.on("scroll", apply);
    carousel.on("reInit", apply);
    return () => {
      carousel.off("scroll", apply);
      carousel.off("reInit", apply);
    };
  }, [carousel, items.length]);
  return (
    <section className="mt-7" aria-label="인기 뉴스">
      <div className="mb-3 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] leading-6 font-bold">
            인기 뉴스 <span className="text-[#6346f6]">TOP 10</span>
          </h2>
          <p className="mt-1 text-[13px] leading-[18px] font-medium text-[#8b95a1]">
            {data?.rankingBasis === "CATALOG_ORDER"
              ? "지금 연습할 수 있는 뉴스예요"
              : "어제 가장 많이 연습한 뉴스예요"}
          </p>
        </div>
        <Link
          href="/news"
          className="flex shrink-0 items-center text-[13px] leading-[18px] font-medium text-[#6b7684]"
        >
          전체 보기
          <Image
            src="/figma/home-phase4/news-see-all.svg"
            alt=""
            width={16}
            height={16}
          />
        </Link>
      </div>
      {loading && !data ? (
        <SkeletonBlock className="h-[54px] rounded-[20px]" />
      ) : items.length ? (
        <Carousel
          orientation="vertical"
          ref={container}
          setApi={setCarousel}
          opts={{ align: "start", loop: items.length > 1, duration: 34 }}
          className={`${styles.ticker} h-[54px] overflow-hidden rounded-[20px] bg-white px-4 py-1`}
          aria-label="인기 뉴스 TOP 10, 위아래로 넘겨 순위 보기"
        >
          <CarouselContent className="mt-0 h-[46px]">
            {items.map((item) => (
              <CarouselItem key={item.id} className={`${styles.slide} pt-0`}>
                <Link
                  href={practiceDetailHref(item.id, "/home")}
                  className={`${styles.row} flex h-[46px] items-center gap-3`}
                  aria-label={`${item.rank}위 ${newsHeadline(item.title)}`}
                >
                  <span className="w-5 shrink-0 whitespace-nowrap text-center text-base leading-[22px] font-bold text-[#6346f6]">
                    {item.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] leading-[21px] font-medium text-[#191f28]">
                    {newsHeadline(item.title)}
                  </span>
                  {data?.rankingBasis === "COMPLETED_USERS" && (
                    <span className="shrink-0 text-xs leading-[17px] font-medium text-[#8b95a1]">
                      {item.usageCount.toLocaleString("ko-KR")}명 연습
                    </span>
                  )}
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      ) : !error ? (
        <p className="rounded-[20px] bg-white p-4 text-sm text-[#8b95a1]">
          아직 공개된 뉴스가 없어요.
        </p>
      ) : null}
      {error && (
        <div role="alert" className="mt-2 text-sm text-[#d91b34]">
          <p>{error}</p>
          <button onClick={retry} className="min-h-11 font-semibold">
            인기 뉴스 다시 불러오기
          </button>
        </div>
      )}
    </section>
  );
}
