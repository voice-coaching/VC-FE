"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import transition from "@/components/prototype-analysis-flow.module.css";
import { NewsPlayer } from "./news/player";
import { FocusedSentencePractice } from "@/components/focused-sentence-practice";

const tabs = ["문장별", "발음 상세", "속도와 억양"] as const;
const panel =
  "rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]";
// Design-test fixtures, not measurements or an analysis of the user's voice.
const demoScores = [77, 90, 84, 73, 86];
const summary = "또렷하게 읽었어요. 문장 끝까지 일정한 속도로 읽어 보세요";

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl bg-[#edf2ff] p-3 text-xs leading-5 text-[#3659ad]">
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

export function CustomPracticeResult({
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
  const [tab, setTab] = useState<(typeof tabs)[number]>("문장별");
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [practiced, setPracticed] = useState<number[]>([]);
  const [seek, setSeek] = useState<{
    position: number;
    id: number;
    playing: boolean;
  }>();
  const duration = 24;
  const total =
    sentences.reduce((sum, sentence) => sum + sentence.length, 0) || 1;
  const playSentence = (index: number) =>
    setSeek((previous) => ({
      position:
        (sentences
          .slice(0, index)
          .reduce((sum, sentence) => sum + sentence.length, 0) /
          total) *
        duration,
      id: (previous?.id ?? 0) + 1,
      playing: true,
    }));
  // Only show words actually in this draft; never recycle news-specific errors.
  const points = sentences
    .map((sentence, index) => ({
      index,
      word: sentence.match(/[가-힣]{2,}/)?.[0],
    }))
    .filter((point) => point.word)
    .slice(0, 6);

  if (focused !== null)
    return (
      <FocusedSentencePractice
        key={focused}
        sentence={sentences[focused]}
        index={focused}
        onBack={() => setFocused(null)}
        onComplete={() => {
          setPracticed((previous) =>
            previous.includes(focused) ? previous : [...previous, focused],
          );
          setSelected(focused);
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
            className="absolute left-2 flex size-10 items-center justify-center active:opacity-50"
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
                좋음
              </span>
            </div>
            <p className="mt-2">
              <strong className="text-[40px] leading-[52px]">82</strong>
              <span className="text-sm text-white/70">점</span>
            </p>
            <p className="mt-4 text-sm leading-5">{summary}</p>
            <NewsPlayer duration={duration} compact seekRequest={seek} />
          </section>
          <div className="grid grid-cols-3 rounded-2xl bg-white py-4 shadow-sm">
            {[
              ["78%", "정확하게 읽음"],
              ["보통", "말하기 속도"],
              ["적정", "억양 변화"],
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
          {sentences.length > 0 && (
            <section className={panel}>
              <h2 className="text-base font-bold">
                이번에는 한 문장만 고쳐볼까요?
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#4e5968]">
                다시 읽고 싶은 문장을 눌러 집중 연습해 보세요. 전체를 처음부터
                녹음하지 않아도 돼요.
              </p>
              {practiced.length > 0 && (
                <p
                  role="status"
                  className="mt-3 text-sm font-bold text-[#2f6bff]"
                >
                  {practiced.length}문장 집중 연습 완료
                </p>
              )}
            </section>
          )}
          <div
            role="tablist"
            aria-label="내 문장 분석 항목"
            className="flex rounded-full bg-[#f2f4f6] p-1"
          >
            {tabs.map((name, index) => (
              <button
                key={name}
                role="tab"
                id={`custom-tab-${index}`}
                aria-selected={tab === name}
                aria-controls="custom-result-panel"
                onClick={() => {
                  setTab(name);
                  setSelected(null);
                }}
                className={`min-h-11 flex-1 rounded-full text-xs font-bold transition-colors duration-200 motion-reduce:transition-none ${tab === name ? "bg-white shadow-sm" : "text-[#8b95a1]"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            key={tab}
            role="tabpanel"
            id="custom-result-panel"
            aria-labelledby={`custom-tab-${tabs.indexOf(tab)}`}
            className={`${transition.enter} space-y-3`}
          >
            {tab === "문장별" ? (
              sentences.map((sentence, index) => (
                <section key={index} className={panel}>
                  <button
                    aria-expanded={selected === index}
                    onClick={() =>
                      setSelected(selected === index ? null : index)
                    }
                    className="flex min-h-11 w-full items-center gap-2 text-left"
                  >
                    <span className="flex-1 text-[15px] leading-[22px] font-medium">
                      {sentence}
                      {practiced.includes(index) && (
                        <span className="mt-2 block text-xs font-bold text-[#2f6bff]">
                          집중 연습 완료
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 text-xs ${demoScores[index % 5] < 80 ? "text-[#ff7154]" : "text-[#8b95a1]"}`}
                    >
                      {demoScores[index % 5]}점
                    </span>
                    <Image
                      src="/figma/auth/chevron-right.svg"
                      alt=""
                      width={16}
                      height={16}
                    />
                  </button>
                  {selected === index && (
                    <div className="mt-3 space-y-3">
                      <Tip>문장 끝까지 일정한 속도로 읽어 보세요</Tip>
                      <button
                        onClick={() => playSentence(index)}
                        className="min-h-11 w-full rounded-xl bg-[#edf2ff] text-sm font-bold text-[#2f6bff]"
                      >
                        {index + 1}번 문장 듣기
                      </button>
                      <button
                        onClick={() => setFocused(index)}
                        className="min-h-12 w-full rounded-xl bg-[#2f6bff] text-sm font-bold text-white"
                      >
                        이 문장만 다시 연습
                      </button>
                    </div>
                  )}
                </section>
              ))
            ) : tab === "발음 상세" ? (
              <>
                <h2 className="flex justify-between text-sm font-bold">
                  발음 연습 포인트
                  <span className="text-xs font-normal text-[#8b95a1]">
                    {points.length}개
                  </span>
                </h2>
                <section className={panel}>
                  <div className="divide-y divide-[#e5e8eb]">
                    {points.map(({ word, index }) => (
                      <button
                        key={index}
                        onClick={() => playSentence(index)}
                        aria-label={`${index + 1}번 문장 듣기: ${word}`}
                        className="flex min-h-16 w-full items-center gap-3 py-3 text-left"
                      >
                        <strong className="max-w-[55%] break-all rounded-xl bg-[#f2f4f6] p-3 text-sm">
                          {word}
                        </strong>
                        <span className="flex-1 text-xs leading-5 text-[#8b95a1]">
                          {index + 1}번 문장
                          <br />
                          또박또박 읽어 보세요
                        </span>
                        <Image
                          src="/figma/announcer/play.svg"
                          alt=""
                          width={16}
                          height={16}
                        />
                      </button>
                    ))}
                  </div>
                  {!points.length && (
                    <p className="text-sm leading-6 text-[#4e5968]">
                      한글 원고를 입력하면 단어별 연습 포인트를 확인할 수
                      있어요.
                    </p>
                  )}
                </section>
                <Tip>입력한 원고의 단어를 천천히 이어 읽어 보세요</Tip>
              </>
            ) : (
              <>
                <section className={panel}>
                  <h2 className="flex justify-between text-sm font-bold">
                    말하기 속도
                    <span className="text-xs font-normal text-[#8b95a1]">
                      분당 <strong className="text-[#191f28]">340</strong>자
                    </span>
                  </h2>
                  <p className="mt-3 text-[11px] text-[#8b95a1]">
                    적정 300~360자
                  </p>
                  <div className="mt-3 flex gap-1">
                    {[0, 1, 2].map((index) => (
                      <span
                        key={index}
                        className={`h-2 flex-1 rounded-full ${index === 1 ? "bg-[#2f6bff]" : "bg-[#e5e8eb]"}`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 mb-4 flex justify-between text-xs text-[#8b95a1]">
                    <span>느림</span>
                    <span className="font-bold text-[#2f6bff]">적정</span>
                    <span>빠름</span>
                  </div>
                  <Tip>지금 속도를 그대로 유지해 보세요</Tip>
                </section>
                <section className={panel}>
                  <h2 className="mb-4 flex justify-between text-sm font-bold">
                    억양 변화
                    <span className="text-xs font-normal text-[#8b95a1]">
                      적정
                    </span>
                  </h2>
                  <Image
                    src="/figma/announcer/custom-intonation.svg"
                    alt="내 억양과 기준 억양 비교 그래프"
                    width={313}
                    height={96}
                    className="mb-3 h-24 w-full rounded-xl"
                  />
                  <div className="mb-4 flex items-center gap-1.5 text-[11px] text-[#8b95a1]">
                    <span className="h-0.5 w-4 bg-[#2f6bff]" />내 억양
                    <span className="ml-3 w-4 border-t-2 border-dashed border-[#b0b8c1]" />
                    기준 억양
                  </div>
                  <Tip>지금 높낮이를 그대로 유지해 보세요</Tip>
                </section>
                {sentences.length > 1 && (
                  <section className={panel}>
                    <h2 className="mb-3 flex justify-between text-sm font-bold">
                      문장 사이 쉼
                      <span className="text-xs font-normal text-[#8b95a1]">
                        평균 0.6초
                      </span>
                    </h2>
                    <p className="mb-3 text-[11px] text-[#8b95a1]">
                      적정 구간 0.4~0.8초
                    </p>
                    <div className="mb-4 space-y-3">
                      {sentences.slice(1).map((_, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-[#4e5968]">
                            {index + 1} → {index + 2}번
                          </span>
                          <span>
                            0.6초{" "}
                            <span className="ml-2 text-[#8b95a1]">적정</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <Tip>지금 쉬는 간격을 그대로 유지해 보세요</Tip>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
        <footer className="flex shrink-0 gap-2.5 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-9">
          <button
            onClick={onRetry}
            className="h-14 flex-1 rounded-full border border-[#e5e8eb] font-bold transition-transform active:scale-[0.98]"
          >
            다시 읽기
          </button>
          <button
            onClick={onFinish}
            className="h-14 flex-1 rounded-full bg-[#2f6bff] font-bold text-white transition-transform active:scale-[0.98]"
          >
            연습 마치기
          </button>
        </footer>
      </section>
    </IPhoneFrame>
  );
}
