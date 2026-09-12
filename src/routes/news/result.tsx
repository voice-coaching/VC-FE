"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FocusedSentencePractice } from "@/components/focused-sentence-practice";
import { IPhoneFrame } from "@/components/iphone-frame";
import transition from "@/components/prototype-analysis-flow.module.css";
import { NewsPlayer } from "./player";
import { newsPracticePoints } from "@/lib/news-practice-points";

const panel =
  "rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]";
const TABS = ["문장별", "발음 상세", "속도와 억양"];
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl bg-[#edf2ff] p-3 text-xs leading-5 text-[#3659ad]">
      <Image
        src="/figma/announcer/ai-sparkle.svg"
        alt=""
        width={20}
        height={20}
        className="size-5"
      />
      <div>{children}</div>
    </div>
  );
}
export function NewsResult({
  sentences,
  onBack,
  onRetry,
  onFinish,
}: {
  sentences: string[];
  onBack: () => void;
  onRetry: () => void;
  onFinish: () => void;
}) {
  const [tab, setTab] = useState("문장별");
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [practiced, setPracticed] = useState<number[]>([]);
  const returnTo = useRef<number | null>(null);
  const sentenceButtons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (focused === null && returnTo.current !== null) {
      const button = sentenceButtons.current[returnTo.current];
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "center" });
      returnTo.current = null;
    }
  }, [focused]);
  const [playing, setPlaying] = useState(false);
  const [seekRequest, setSeekRequest] = useState<{
    position: number;
    id: number;
    playing: boolean;
  }>();
  const groups = newsPracticePoints(sentences);
  if (focused !== null)
    return (
      <FocusedSentencePractice
        key={focused}
        mode="news"
        sentence={sentences[focused]}
        index={focused}
        onBack={() => setFocused(null)}
        onComplete={() => {
          setPracticed((previous) =>
            previous.includes(focused) ? previous : [...previous, focused],
          );
          setFocused(null);
        }}
      />
    );
  return (
    <IPhoneFrame>
      <section
        className={`${transition.enter} flex h-full flex-col bg-[#fafbfc] text-[#191f28]`}
      >
        <div className="h-11 shrink-0" />
        <header className="relative flex h-12 shrink-0 items-center justify-center">
          <button
            aria-label="녹음 확인으로 돌아가기"
            onClick={onBack}
            className="absolute left-2 flex size-10 items-center justify-center"
          >
            <NavigationIcon />
          </button>
          <h1 className="text-[17px] font-bold">분석 결과</h1>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-2 pb-6 [scrollbar-width:none]">
          <section className="rounded-[18px] bg-[linear-gradient(145deg,#2a63f6,#5e8cff)] p-5 text-white shadow-lg shadow-blue-700/15">
            <div className="flex justify-between text-xs text-white/70">
              <span>발음 정확도</span>
              <span className="rounded-full bg-white/20 px-2 py-1 font-bold text-white">
                보통
              </span>
            </div>
            <p className="mt-2">
              <strong className="text-[40px] leading-[52px]">76</strong>
              <span className="text-sm text-white/70">점</span>
            </p>
            <p className="mt-4 text-sm leading-5">
              핵심 정보를 또렷하게 전달하고, 긴 문장은 호흡을 나누어 읽어 보세요
            </p>
            <NewsPlayer
              duration={24}
              compact
              seekRequest={seekRequest}
              onPlayingChange={setPlaying}
            />
          </section>
          <div className="grid grid-cols-3 rounded-2xl bg-white py-4 shadow-sm">
            {[
              ["71%", "정확하게 읽음"],
              ["빠름", "말하기 속도"],
              ["평탄", "억양 변화"],
            ].map(([value, label], index) => (
              <div
                key={label}
                className={`text-center ${index ? "border-l border-[#e5e8eb]" : ""}`}
              >
                <p className="text-lg font-bold">{value}</p>
                <p className="mt-1 text-[11px] text-[#8b95a1]">{label}</p>
              </div>
            ))}
          </div>
          <div
            role="tablist"
            aria-label="뉴스 분석 항목"
            className="flex rounded-full bg-[#f2f4f6] p-1"
          >
            {TABS.map((name, index) => (
              <button
                key={name}
                id={`news-tab-${index}`}
                role="tab"
                aria-selected={tab === name}
                aria-controls="news-result-panel"
                onClick={() => {
                  setTab(name);
                  setSelected(null);
                }}
                className={`h-9 flex-1 rounded-full text-xs font-bold ${tab === name ? "bg-white shadow-sm" : "text-[#8b95a1]"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            key={tab}
            id="news-result-panel"
            role="tabpanel"
            aria-labelledby={`news-tab-${TABS.indexOf(tab)}`}
            className={`${transition.enter} space-y-3`}
          >
            {tab === "문장별" && (
              <p className="px-1 text-xs leading-5 text-[#4e5968]">
                문장을 누르면 이 문장만 다시 연습할 수 있어요.
              </p>
            )}
            {tab === "문장별" ? (
              sentences.map((sentence, index) => (
                <div key={index} className={panel}>
                  <button
                    ref={(element) => {
                      sentenceButtons.current[index] = element;
                    }}
                    onClick={() =>
                      setSelected(selected === sentence ? null : sentence)
                    }
                    aria-expanded={selected === sentence}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    <span className="flex-1 text-sm leading-5 font-medium">
                      {sentence}
                    </span>
                    <span
                      className={`shrink-0 text-xs ${index % 2 === 0 ? "text-[#ff6347]" : "text-[#8b95a1]"}`}
                    >
                      {[66, 82, 70, 85, 77][index % 5]}점
                    </span>
                    <Image
                      src="/figma/auth/chevron-right.svg"
                      alt=""
                      width={16}
                      height={16}
                    />
                  </button>
                  {practiced.includes(index) && (
                    <p className="mt-2 text-xs font-bold text-[#2f6bff]">
                      집중 연습 완료
                    </p>
                  )}
                  {(index === 0 || selected === sentence) && (
                    <p className="mt-2 text-[11px] text-[#8b95a1]">
                      문장 끝까지 일정한 속도로 읽어 보세요
                    </p>
                  )}
                  {selected === sentence && (
                    <div className="mt-3">
                      <Tip>문장을 짧게 나누어 천천히 읽어 보세요.</Tip>
                      <button
                        onClick={() => {
                          returnTo.current = index;
                          setPlaying(false);
                          setSeekRequest((previous) => ({
                            position: previous?.position ?? 0,
                            id: (previous?.id ?? 0) + 1,
                            playing: false,
                          }));
                          setFocused(index);
                        }}
                        className="mt-3 min-h-12 w-full rounded-xl bg-[#2f6bff] text-sm font-bold text-white"
                      >
                        이 문장만 다시 연습
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : tab === "발음 상세" ? (
              <>
                <h2 className="flex justify-between text-sm font-bold">
                  이 기사로 연습할 표현
                  <span className="text-xs font-normal text-[#8b95a1]">
                    {groups.reduce((sum, group) => sum + group.items.length, 0)}
                    개
                  </span>
                </h2>
                {groups.map((group) => (
                  <section key={group.title} className={panel}>
                    <h3 className="mb-2 text-sm font-bold">
                      {group.title}
                      <span className="ml-2 text-xs font-normal text-[#8b95a1]">
                        {group.items.length}곳
                      </span>
                    </h3>
                    <div className="divide-y divide-[#e5e8eb]">
                      {group.items.map(({ word: letter, line }, index) => {
                        const id = group.title + index;
                        return (
                          <div key={id}>
                            <button
                              aria-expanded={selected === id}
                              onClick={() =>
                                setSelected(selected === id ? null : id)
                              }
                              className="flex w-full items-center gap-3 py-3 text-left"
                            >
                              <strong className="max-w-[50%] break-all rounded-xl bg-[#f2f4f6] p-3 text-sm">
                                {letter}
                              </strong>
                              <div className="flex-1 text-xs leading-5 text-[#8b95a1]">
                                천천히 또렷하게 읽어 보세요
                                <p>{line + 1}번 문장</p>
                              </div>
                              <Image
                                src="/figma/auth/chevron-right.svg"
                                alt=""
                                width={16}
                                height={16}
                              />
                            </button>
                            {selected === id && (
                              <Tip>
                                ‘{letter}’ 표현을 문장 안에서 또렷하게 읽어
                                보세요.
                              </Tip>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
                <Tip>
                  기사에 있는 표현을 골랐어요. 인식된 발음 오류가 아니라 읽기
                  연습 포인트예요.
                </Tip>
                {groups.length === 0 && (
                  <p className={panel}>
                    선택할 표현이 없어요. 문장별 탭에서 전체 문장을 연습해
                    보세요.
                  </p>
                )}
              </>
            ) : (
              <>
                <section className={panel}>
                  <h2 className="text-sm font-bold">
                    말하기 속도{" "}
                    <span className="float-right text-xs font-normal text-[#8b95a1]">
                      분당{" "}
                      <strong className="text-sm text-[#191f28]">392</strong>자
                    </span>
                  </h2>
                  <p className="mt-3 text-[11px] text-[#8b95a1]">
                    적정 300~360자
                  </p>
                  <div className="mt-3 mb-2 flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`h-2 flex-1 rounded-full ${i === 2 ? "bg-[#ff6347]" : "bg-[#e5e8eb]"}`}
                      />
                    ))}
                  </div>
                  <div className="mb-4 flex justify-between text-xs text-[#8b95a1]">
                    <span>느림</span>
                    <span>적정</span>
                    <span className="text-[#ff6347]">빠름</span>
                  </div>
                  <button
                    onClick={() =>
                      setSeekRequest((previous) => ({
                        position: 0,
                        id: (previous?.id ?? 0) + 1,
                        playing: !playing,
                      }))
                    }
                    aria-label={
                      playing ? "녹음 일시정지" : "1번 문장부터 녹음 재생"
                    }
                    className="mb-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-[#f2f4f6] px-3 text-xs font-medium active:opacity-70"
                  >
                    1번 문장에서 가장 빨랐어요
                    <Image
                      src={`/figma/announcer/${playing ? "pause" : "play"}.svg`}
                      alt=""
                      width={16}
                      height={16}
                    />
                  </button>
                  <Tip>한 문장을 두 호흡으로 나눠 읽으면 속도가 잡혀요</Tip>
                </section>
                <section className={panel}>
                  <h2 className="mb-4 text-sm font-bold">
                    억양 변화{" "}
                    <span className="float-right text-xs font-normal text-[#ff6347]">
                      평탄
                    </span>
                  </h2>
                  <div className="rounded-xl bg-[#f2f4f6] px-3 py-4">
                    <svg
                      viewBox="0 0 320 72"
                      role="img"
                      aria-label="내 억양은 기준 억양보다 높낮이 변화가 작아요"
                      className="h-16 w-full overflow-visible"
                    >
                      <path
                        d="M0 24 C28 -1 48 -2 76 12 S114 24 140 15 S174 2 202 18 S236 38 263 23 S294 6 320 13"
                        fill="none"
                        stroke="#b0b8c1"
                        strokeWidth="2"
                        strokeDasharray="5 5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0 20 C28 7 48 6 76 15 S114 19 140 15 S174 10 202 18 S236 24 263 18 S294 11 320 15"
                        fill="none"
                        stroke="#2f6bff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="mt-3 mb-4 flex items-center gap-1.5 text-[11px] text-[#8b95a1]">
                    <span className="h-0.5 w-4 bg-[#2f6bff]" />내 억양
                    <span className="ml-3 w-4 border-t-2 border-dashed border-[#b0b8c1]" />
                    기준 억양
                  </div>
                  <Tip>문장 끝을 조금 더 내렸다 올리면 생동감이 살아나요</Tip>
                </section>
                <section className={panel}>
                  <h2 className="flex justify-between text-sm font-bold">
                    문장 사이 쉼
                    <span className="text-xs font-normal text-[#8b95a1]">
                      평균 0.3초
                    </span>
                  </h2>
                  <p className="mt-1 text-[11px] text-[#8b95a1]">
                    적정 구간 0.4~0.8초
                  </p>
                  <div className="my-4 space-y-3">
                    {[0.2, 0.3, 0.5]
                      .slice(0, Math.max(0, sentences.length - 1))
                      .map((pause, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 text-xs"
                        >
                          <span className="shrink-0 text-[#4e5968]">
                            {index + 1} → {index + 2}번
                          </span>
                          <div className="relative h-1.5 min-w-0 flex-1 rounded-full bg-[#f2f4f6]">
                            <span className="absolute left-[40%] h-full w-[40%] rounded-full bg-[#d6e2ff]" />
                            <span
                              className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${pause < 0.4 ? "bg-[#ff6347]" : "bg-[#2f6bff]"}`}
                              style={{ left: `${pause * 100}%` }}
                            />
                          </div>
                          <strong className="ml-4 tabular-nums">
                            {pause.toFixed(1)}초
                          </strong>
                          <span
                            className={`w-8 text-[11px] ${pause < 0.4 ? "text-[#ff6347]" : "text-[#8b95a1]"}`}
                          >
                            {pause < 0.4 ? "짧아요" : "적정"}
                          </span>
                        </div>
                      ))}
                  </div>
                  <Tip>문장 끝에서 반 박자만 더 쉬면 전달이 또렷해져요</Tip>
                </section>
              </>
            )}
          </div>
        </div>
        <footer className="flex shrink-0 gap-2.5 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-9">
          <button
            onClick={onRetry}
            className="h-14 flex-1 rounded-full border border-[#e5e8eb] font-bold active:scale-[0.98]"
          >
            다시 읽기
          </button>
          <button
            onClick={onFinish}
            className="h-14 flex-1 rounded-full bg-[#2f6bff] font-bold text-white active:scale-[0.98]"
          >
            연습 마치기
          </button>
        </footer>
      </section>
    </IPhoneFrame>
  );
}
