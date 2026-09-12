"use client";
import Image from "next/image";
import Link from "next/link";
import { usePrototypeHistory } from "@/hooks/use-prototype-history";
import { modeLabels, todaySummary } from "@/lib/prototype-history";

export function PracticeHistoryContent() {
  const { items, error, ready } = usePrototypeHistory();
  const today = todaySummary(items);
  return (
    <>
      <div className="space-y-4 pb-4">
        <section className="relative flex min-h-40 items-center overflow-hidden rounded-2xl bg-[#edf2ff] p-5">
          <div className="relative z-10 min-w-0 flex-1 pr-28">
            <h2 className="text-xl leading-snug font-bold break-keep">
              오늘 {today.sentences}문장
              <br />
              연습했어요
            </h2>
            <p className="mt-2 text-sm leading-relaxed break-keep text-[#3659ad]">
              {today.dailyDone
                ? "오늘의 연습 완료"
                : "나만의 속도로 이어가세요"}
            </p>
          </div>
          {/* Preserve the Figma original; the card crops only the lower body. */}
          <Image
            src="/figma/practice-mascot.png"
            alt=""
            aria-hidden="true"
            width={1075}
            height={1463}
            sizes="160px"
            draggable={false}
            className="pointer-events-none absolute -right-2 -bottom-11 h-[218px] w-40 max-w-none select-none"
          />
        </section>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            기록을 읽거나 변경하지 못했어요. 브라우저 저장 공간 설정을 확인해
            주세요.
          </p>
        ) : !ready ? (
          <p>기록을 불러오고 있어요.</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white p-5">
            <h2 className="font-bold">아직 완료한 연습이 없어요</h2>
            <p className="mt-2 text-sm text-[#4e5968]">
              결과에서 연습 마치기를 누르면 여기에 기록돼요.
            </p>
            <Link
              href="/news/today"
              className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-[#2f6bff] font-bold text-white"
            >
              오늘의 3문장 시작하기
            </Link>
          </div>
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-2xl bg-white p-5">
                <p className="text-xs font-bold text-[#2f6bff]">
                  {modeLabels[item.mode]} {item.sentenceCount}문장 완료
                </p>
                <h2 className="mt-2 font-bold">{item.title}</h2>
                <time
                  dateTime={item.completedAt}
                  className="mt-2 block text-xs text-[#8b95a1]"
                >
                  {new Date(item.completedAt).toLocaleString("ko-KR")}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
