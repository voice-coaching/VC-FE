"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FocusedSentencePractice } from "./focused-sentence-practice";
import { PracticeWave } from "./practice-wave";
import { Play, Pause, ChevronRight } from "lucide-react";
import { IPhoneFrame } from "@/components/iphone-frame";

const TABS = ["문장별", "발음 상세", "속도와 억양"] as const;
const SENTENCES = [
  "시청자 여러분 안녕하십니까. 구월 이일 아침 뉴스입니다.",
  "오늘 첫 소식은 한국은행의 기준금리 결정입니다.",
  "자세한 내용 취재기자 연결해 알아보겠습니다.",
];
const panel =
  "rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]";

function Wave({
  pale = false,
  active = false,
  tone = "primary",
}: {
  pale?: boolean;
  active?: boolean;
  tone?: "primary" | "neutral";
}) {
  return <PracticeWave compact pale={pale} active={active} tone={tone} />;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-[#edf2ff] px-3.5 py-3 text-[12px] leading-[18px] text-[#3659ad]">
      <Image
        src="/figma/announcer/ai-sparkle.svg"
        alt=""
        width={20}
        height={20}
        className="size-5 shrink-0"
      />
      <div>{children}</div>
    </div>
  );
}

export function AnnouncerResult({
  durationMs,
  onBack,
  onRetry,
  onFinish,
}: {
  url: string;
  durationMs: number;
  onBack: () => void;
  onRetry: () => void;
  onFinish: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("문장별");
  const [activeTrack, setActiveTrack] = useState<"mine" | "announcer" | null>(
    null,
  );
  const [positions, setPositions] = useState({ mine: 0, announcer: 0 });
  const playing = activeTrack === "mine";
  const [selected, setSelected] = useState<number | null>(null);
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
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!activeTrack) return;
    const limit = activeTrack === "mine" ? durationMs / 1000 : 42;
    const timer = setInterval(() => {
      setPositions((previous) => ({
        ...previous,
        [activeTrack]: Math.min(limit, previous[activeTrack] + 0.1),
      }));
    }, 100);
    const end = setTimeout(
      () => setActiveTrack(null),
      Math.max(0, limit - positions[activeTrack]) * 1000,
    );
    return () => {
      clearInterval(timer);
      clearTimeout(end);
    };
    // Restart only when the selected playback changes, not on each clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrack, durationMs]);
  const seconds = Math.floor(durationMs / 1000);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  function toggle(track: "mine" | "announcer" = "mine") {
    const limit = track === "mine" ? durationMs / 1000 : 42;
    if (positions[track] >= limit)
      setPositions((previous) => ({ ...previous, [track]: 0 }));
    setActiveTrack(activeTrack === track ? null : track);
  }
  const formatPosition = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  const mineTime =
    positions.mine > 0 || playing ? formatPosition(positions.mine) : time;
  const playIcon = playing ? (
    <Pause size={16} fill="currentColor" />
  ) : (
    <Play size={16} fill="currentColor" />
  );
  if (focused !== null)
    return (
      <FocusedSentencePractice
        key={focused}
        mode="announcer"
        sentence={SENTENCES[focused]}
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
      <section className="flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" />
        <header className="relative flex h-12 shrink-0 items-center justify-center">
          <button
            type="button"
            aria-label="녹음 확인으로 돌아가기"
            onClick={onBack}
            className="absolute left-2 flex size-10 items-center justify-center active:opacity-50"
          >
            <NavigationIcon />
          </button>
          <h1 className="text-[17px] font-bold">분석 결과</h1>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-6 [scrollbar-width:none]">
          <section className="rounded-[18px] bg-gradient-to-br from-[#285fff] to-[#608cff] p-5 text-white shadow-[0_6px_12px_rgba(47,107,255,0.18)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">발음 정확도</span>
              <span className="rounded-full bg-white/20 px-2.5 py-1 font-bold">
                보통
              </span>
            </div>
            <p className="mt-2">
              <strong className="text-[42px] leading-[52px] tracking-tight">
                79
              </strong>
              <span className="text-base text-white/70">점</span>
            </p>
            <p className="mt-4 text-[13px] leading-5">
              억양은 잘 따라갔어요. 속도가 조금 느렸어요
            </p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-full bg-white/20 p-1.5 pr-4">
              <button
                type="button"
                onClick={() => toggle()}
                aria-label={playing ? "내 녹음 일시정지" : "내 녹음 재생"}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#2f6bff] active:scale-95"
              >
                {playIcon}
              </button>
              <Wave pale active={playing} />
              <span className="text-xs tabular-nums">{mineTime}</span>
            </div>
          </section>
          <div className="my-4 grid grid-cols-3 rounded-2xl bg-white py-4 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
            {[
              ["81%", "정확하게 읽음"],
              ["느림", "말하기 속도"],
              ["비슷", "억양 일치도"],
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
          <section className={panel}>
            <h2 className="mb-3 text-sm font-bold">아나운서와 비교</h2>
            <div className="mb-3 flex items-center gap-3">
              <button
                type="button"
                aria-label={
                  activeTrack === "announcer"
                    ? "아나운서 일시정지"
                    : "아나운서 재생"
                }
                onClick={() => toggle("announcer")}
                className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:scale-95 ${activeTrack === "announcer" ? "bg-[#e5e8eb] text-[#6b7684]" : "bg-[#f2f4f6] text-[#8b95a1]"}`}
              >
                {activeTrack === "announcer" ? (
                  <Pause size={13} fill="currentColor" />
                ) : (
                  <Play size={13} fill="currentColor" />
                )}
              </button>
              <div className="flex-1">
                <p className="text-xs text-[#8b95a1]">아나운서</p>
                <Wave tone="neutral" active={activeTrack === "announcer"} />
              </div>
              <span className="text-xs tabular-nums text-[#8b95a1]">
                {positions.announcer > 0 || activeTrack === "announcer"
                  ? formatPosition(positions.announcer)
                  : "00:42"}
              </span>
            </div>
            <div className="mb-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggle()}
                aria-label={playing ? "내 녹음 일시정지" : "내 녹음 재생"}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#edf2ff] text-[#2f6bff]"
              >
                {playIcon}
              </button>
              <div className="flex-1">
                <p className="text-xs text-[#8b95a1]">내 녹음</p>
                <Wave active={playing} />
              </div>
              <span className="text-xs tabular-nums text-[#8b95a1]">
                {mineTime}
              </span>
            </div>
            <Tip>
              아나운서보다 3초 느리게 읽었어요
              <p className="mt-1 text-[#7995d7]">
                억양 흐름은 비슷하게 따라갔어요
              </p>
            </Tip>
          </section>
          {notice && (
            <p role="status" className="mt-3 text-xs text-[#4e5968]">
              {notice}
            </p>
          )}
          <div
            role="tablist"
            aria-label="분석 항목"
            className="my-4 flex rounded-full bg-[#f2f4f6] p-1"
          >
            {TABS.map((name) => (
              <button
                type="button"
                role="tab"
                id={`tab-${TABS.indexOf(name)}`}
                aria-controls="result-panel"
                aria-selected={name === tab}
                key={name}
                onClick={() => {
                  setTab(name);
                  setSelected(null);
                }}
                className={`h-9 flex-1 rounded-full text-[13px] font-bold transition-colors duration-200 ${name === tab ? "bg-white text-[#191f28] shadow-sm" : "text-[#8b95a1]"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="result-panel"
            aria-labelledby={`tab-${TABS.indexOf(tab)}`}
          >
            {tab === "문장별" && (
              <div className="space-y-3">
                <p className="px-1 text-xs leading-5 text-[#4e5968]">
                  문장을 누르면 이 문장만 다시 연습할 수 있어요.
                </p>
                {SENTENCES.map((sentence, index) => (
                  <section key={index} className={panel}>
                    <button
                      ref={(element) => {
                        sentenceButtons.current[index] = element;
                      }}
                      type="button"
                      key={sentence}
                      onClick={() =>
                        setSelected(selected === index ? null : index)
                      }
                      aria-expanded={selected === index}
                      className="min-h-11 w-full text-left"
                    >
                      <div className="flex items-center gap-2">
                        <p className="flex-1 text-sm leading-[22px] font-medium">
                          {index === 0 ? (
                            <>
                              시청자 여러분 안녕하
                              <span className="text-[#ff334b]">십니</span>까.
                              구월 이일 아침 뉴스입니다.
                            </>
                          ) : (
                            sentence
                          )}
                        </p>
                        <span
                          className={`shrink-0 text-xs ${index === 0 ? "text-[#ff6b50]" : "text-[#8b95a1]"}`}
                        >
                          {[72, 84, 81][index]}점
                        </span>
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-[#b0b8c1]"
                        />
                      </div>
                      {(index === 0 || selected === index) && (
                        <p className="mt-2 text-[11px] text-[#8b95a1]">
                          {index === 0 ? (
                            <>
                              이렇게 들렸어요{" "}
                              <span className="ml-1 text-[#ff334b]">
                                십니가
                              </span>
                            </>
                          ) : (
                            "예시 문장 평가입니다. 정확한 피드백은 실제 분석 후 제공돼요."
                          )}
                        </p>
                      )}
                    </button>
                    {practiced.includes(index) && (
                      <p className="mt-2 text-xs font-bold text-[#2f6bff]">
                        집중 연습 완료
                      </p>
                    )}
                    {selected === index && (
                      <button
                        onClick={() => {
                          returnTo.current = index;
                          setActiveTrack(null);
                          setFocused(index);
                        }}
                        className="mt-3 min-h-12 w-full rounded-xl bg-[#2f6bff] text-sm font-bold text-white"
                      >
                        이 문장만 다시 연습
                      </button>
                    )}
                  </section>
                ))}
              </div>
            )}
            {tab === "발음 상세" && (
              <div className="space-y-3">
                <h2 className="flex justify-between text-sm font-bold">
                  개선이 필요한 음절 <span>5개</span>
                </h2>
                {[
                  {
                    title: "받침 발음",
                    items: [
                      ["십", "십", "1"],
                      ["했", "해", "2"],
                      ["겠", "게", "3"],
                    ],
                  },
                  {
                    title: "된소리",
                    items: [
                      ["까", "가", "1"],
                      ["짜", "자", "3"],
                    ],
                  },
                ].map((group) => (
                  <section key={group.title} className={panel}>
                    <h3 className="text-sm font-bold">
                      {group.title}{" "}
                      <span className="ml-1 text-xs font-normal text-[#8b95a1]">
                        {group.items.length}곳
                      </span>
                    </h3>
                    {group.items.map(([syllable, heard, line], index) => (
                      <div
                        key={syllable}
                        className={`flex items-center gap-3 py-3 ${index ? "border-t border-[#e5e8eb]" : ""}`}
                      >
                        <span className="flex size-10 items-center justify-center rounded-xl bg-[#f2f4f6] text-lg font-bold">
                          {syllable}
                        </span>
                        <div className="text-xs leading-5 text-[#8b95a1]">
                          이렇게 들렸어요{" "}
                          <span className="ml-1 text-[#ff334b]">{heard}</span>
                          <p>{line}번 문장</p>
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
                <Tip>
                  <strong>자음과 모음은 정확해요</strong>
                  <p className="mt-1 text-[#7995d7]">
                    46개 음절 중 41개를 또렷하게 읽었어요
                  </p>
                </Tip>
              </div>
            )}
            {tab === "속도와 억양" && (
              <div className="space-y-3">
                <section className={panel}>
                  <h2 className="flex justify-between text-sm font-bold">
                    말하기 속도{" "}
                    <span className="text-xs font-normal text-[#8b95a1]">
                      분당 <strong className="text-[#191f28]">268</strong>자
                    </span>
                  </h2>
                  <p className="mt-3 text-[11px] text-[#8b95a1]">
                    적정 300~360자
                  </p>
                  <div className="mt-3 flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`h-2 flex-1 rounded-full ${i === 0 ? "bg-[#ff7053]" : "bg-[#e5e8eb]"}`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-[#8b95a1]">
                    <span className="text-[#ff7053]">느림</span>
                    <span>적정</span>
                    <span>빠름</span>
                  </div>
                  <p className="my-3 rounded-xl bg-[#f2f4f6] p-3 text-xs">
                    1번 문장에서 가장 느렸어요
                  </p>
                  <Tip>기준 음성에 맞춰 조금 더 붙여 읽어 보세요</Tip>
                </section>
                <section className={panel}>
                  <h2 className="flex justify-between text-sm font-bold">
                    억양 일치도{" "}
                    <span className="text-xs font-normal text-[#8b95a1]">
                      비슷
                    </span>
                  </h2>
                  <div className="my-3 rounded-xl bg-[#f2f4f6] p-3">
                    <svg
                      viewBox="0 0 300 80"
                      className="h-20 w-full"
                      role="img"
                      aria-label="예시 억양 비교 곡선"
                    >
                      <path
                        d="M0 35 Q35 0 70 23 T140 25 T210 32 T300 22"
                        fill="none"
                        stroke="#b0b8c1"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      <path
                        d="M0 40 Q35 2 70 25 T140 28 T210 35 T300 26"
                        fill="none"
                        stroke="#2f6bff"
                        strokeWidth="2.5"
                      />
                    </svg>
                  </div>
                  <p className="mb-3 text-[11px] text-[#8b95a1]">
                    <span className="mr-1 inline-block h-0.5 w-4 bg-[#2f6bff] align-middle" />
                    내 억양
                    <span className="mr-1 ml-4 inline-block w-4 border-t-2 border-dashed border-[#b0b8c1] align-middle" />
                    기준 억양
                  </p>
                  <Tip>지금 흐름을 유지하면서 읽어 보세요</Tip>
                </section>
                <section className={panel}>
                  <h2 className="flex justify-between text-sm font-bold">
                    문장 사이 쉼{" "}
                    <span className="text-xs font-normal text-[#8b95a1]">
                      평균 1.1초
                    </span>
                  </h2>
                  <p className="mt-2 text-[11px] text-[#8b95a1]">
                    적정 구간 0.4~0.8초
                  </p>
                  {["1 → 2번", "2 → 3번"].map((label, index) => (
                    <div
                      key={label}
                      className="mt-4 flex items-center gap-3 text-xs"
                    >
                      <span className="text-[#4e5968]">{label}</span>
                      <div className="relative h-1 flex-1 rounded-full bg-[#f2f4f6]">
                        <span
                          className={`absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full ${index ? "left-2/3 bg-[#2f6bff]" : "right-0 bg-[#ff7053]"}`}
                        />
                      </div>
                      <strong>{index ? "0.8초" : "1.4초"}</strong>
                      <span
                        className={index ? "text-[#8b95a1]" : "text-[#ff7053]"}
                      >
                        {index ? "적정" : "길어요"}
                      </span>
                    </div>
                  ))}
                </section>
              </div>
            )}
          </div>
        </div>
        <footer className="flex shrink-0 gap-2.5 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-9">
          <button
            type="button"
            onClick={onRetry}
            className="h-14 flex-1 rounded-full border border-[#e5e8eb] font-bold active:scale-[0.98]"
          >
            다시 읽기
          </button>
          <button
            type="button"
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
