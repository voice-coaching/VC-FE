"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { useEffect, useState } from "react";
import { IPhoneFrame } from "./iphone-frame";
import { PracticeWave } from "./practice-wave";
import transition from "./prototype-analysis-flow.module.css";

const panel =
  "rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]";
function Asset({ name, size = 20 }: { name: string; size?: number }) {
  return <Image src={`/figma/${name}.svg`} alt="" width={size} height={size} />;
}
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#edf2ff] p-3 text-[13px] leading-5 font-medium text-[#3659ad]">
      <Asset name="announcer/ai-sparkle" />
      <span>{children}</span>
    </div>
  );
}

export function SentenceResult({
  sentence,
  onBack,
  onRetry,
  onFinish,
}: {
  sentence: string;
  onBack: () => void;
  onRetry: () => void;
  onFinish: () => void;
}) {
  const [tab, setTab] = useState("발음");
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const syllables = [...sentence.replace(/\s/g, "")];
  const problems = syllables
    .map((letter, index) => ({ letter, index }))
    .filter(({ letter }) => letter === "맑" || letter === "싯");
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setElapsed((value) => Math.min(6, value + 0.1)),
      100,
    );
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (elapsed >= 6) setPlaying(false);
  }, [elapsed]);
  const toggle = () => {
    if (elapsed >= 6) setElapsed(0);
    setPlaying(!playing);
  };
  const problem = selected === null ? null : syllables[selected];
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
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pt-2 pb-6 [scrollbar-width:none]">
          <section className="rounded-[18px] bg-[linear-gradient(145deg,#2a63f6,#5e8cff)] px-5 pt-[22px] pb-[18px] text-white shadow-[0_8px_20px_-4px_rgba(41,92,229,0.28)]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-white/70">발음 정확도</span>
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">
                좋음
              </span>
            </div>
            <p className="mt-1">
              <strong className="text-[40px] leading-[52px] tracking-[-1.128px]">
                84
              </strong>
              <span className="text-lg text-white/70">점</span>
            </p>
            <p className="mt-4 text-sm leading-5">
              겹받침만 조금 아쉬웠어요. 나머지는 정확했어요
            </p>
            <div className="mt-4 flex h-[52px] items-center gap-3 rounded-full bg-white/15 py-1.5 pr-[18px] pl-1.5">
              <button
                aria-label={playing ? "일시정지" : "녹음 재생"}
                onClick={toggle}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white transition-transform active:scale-95"
              >
                <Asset
                  name={`announcer/${playing ? "pause" : "play"}`}
                  size={18}
                />
              </button>
              <div
                aria-hidden="true"
                className="flex h-[34px] min-w-0 flex-1 items-center justify-center gap-[3px]"
              >
                <PracticeWave compact pale active={playing} />
              </div>
              <span className="text-xs text-white/70 tabular-nums">
                00:{String(Math.floor(elapsed || 6)).padStart(2, "0")}
              </span>
            </div>
          </section>
          <div className="grid grid-cols-3 rounded-2xl bg-white py-4 shadow-sm">
            {[
              ["86%", "정확하게 읽음"],
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
          <div
            className="flex rounded-full bg-[#f2f4f6] p-1"
            role="tablist"
            aria-label="분석 항목"
          >
            {["발음", "속도와 억양"].map((name, index) => (
              <button
                id={`sentence-tab-${index}`}
                role="tab"
                aria-selected={tab === name}
                aria-controls="sentence-result-panel"
                key={name}
                onClick={() => setTab(name)}
                className={`h-9 flex-1 rounded-full text-sm font-bold transition-colors duration-300 ${tab === name ? "bg-white shadow-sm" : "text-[#8b95a1]"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            id="sentence-result-panel"
            role="tabpanel"
            aria-labelledby={`sentence-tab-${tab === "발음" ? 0 : 1}`}
            key={tab}
            className={`${transition.enter} space-y-4`}
          >
            {tab === "발음" ? (
              <>
                <section className={panel}>
                  <div className="mb-4 flex justify-between text-xs text-[#8b95a1]">
                    <span>음절을 눌러 확인해 보세요</span>
                    <span>{syllables.length}음절</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {syllables.map((letter, index) => (
                      <button
                        key={index}
                        aria-pressed={selected === index}
                        onClick={() =>
                          setSelected(selected === index ? null : index)
                        }
                        className={`h-[42px] rounded-xl text-lg font-semibold transition-all duration-200 active:scale-95 ${letter === "맑" || letter === "싯" ? "bg-[#fdecf0] text-[#d91b34]" : "bg-[#f2f4f6]"} ${selected === index ? "ring-2 ring-[#2f6bff]" : ""}`}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[#8b95a1]">
                    <span className="size-2 rounded-full bg-[#e5e8eb]" />
                    정확
                    <span className="ml-2 size-2 rounded-full bg-[#fdecf0]" />
                    개선 필요
                  </p>
                  {problem && (
                    <Tip>
                      {problem === "맑"
                        ? "겹받침 ㄺ을 또렷하게 읽어 보세요."
                        : problem === "싯"
                          ? "사이시옷 발음에 집중해 보세요."
                          : `‘${problem}’ 음절을 정확하게 읽었어요.`}
                    </Tip>
                  )}
                </section>
                <h2 className="flex justify-between text-sm font-bold">
                  개선이 필요한 음절
                  <span className="font-normal text-[#8b95a1]">
                    {problems.length}개
                  </span>
                </h2>
                {problems.length > 0 && (
                  <section className={`${panel} divide-y divide-[#e5e8eb]`}>
                    {problems.map(({ letter, index }) => (
                      <button
                        key={index}
                        onClick={() => setSelected(index)}
                        className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0"
                      >
                        <span className="flex size-10 items-center justify-center rounded-xl bg-[#f2f4f6] text-lg font-bold">
                          {letter}
                        </span>
                        <div className="flex-1 text-xs leading-5 text-[#8b95a1]">
                          <p>
                            이렇게 들렸어요{" "}
                            <span className="ml-1 text-[#d91b34]">
                              {letter === "맑" ? "마근" : "싣"}
                            </span>
                          </p>
                          <p>{letter === "맑" ? "겹받침 ㄺ" : "사이시옷"}</p>
                        </div>
                        <Asset name="auth/chevron-right" />
                      </button>
                    ))}
                  </section>
                )}
              </>
            ) : (
              <>
                <section className={panel}>
                  <h2 className="flex justify-between text-sm font-bold">
                    말하기 속도
                    <span className="text-xs font-normal text-[#8b95a1]">
                      분당{" "}
                      <strong className="text-base text-[#191f28]">310</strong>
                      자
                    </span>
                  </h2>
                  <p className="mt-3 text-xs text-[#8b95a1]">적정 300~360자</p>
                  <div className="mt-3 flex gap-1">
                    {[0, 1, 2].map((index) => (
                      <span
                        key={index}
                        className={`h-2.5 flex-1 rounded-full ${index === 1 ? "bg-[#2f6bff]" : "bg-[#e5e8eb]"}`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-[#8b95a1]">
                    <span>느림</span>
                    <span className="font-bold text-[#2f6bff]">적정</span>
                    <span>빠름</span>
                  </div>
                  <button
                    onClick={toggle}
                    className="mt-3 flex w-full items-center justify-between rounded-xl bg-[#f2f4f6] p-3 text-xs font-medium"
                  >
                    겹받침 구간에서만 살짝 느려졌어요
                    <Asset
                      name={`announcer/${playing ? "pause" : "play"}`}
                      size={16}
                    />
                  </button>
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
                    src="/figma/announcer/sentence-intonation.svg"
                    alt="완만하게 높아지고 낮아지는 억양 곡선"
                    width={326}
                    height={96}
                    className="h-24 w-full rounded-xl bg-[#f2f4f6]"
                  />
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-[#8b95a1]">
                    <span className="h-0.5 w-4 bg-[#2f6bff]" />내 억양
                    <span className="ml-3 w-4 border-t-2 border-dashed border-[#b0b8c1]" />
                    기준 억양
                  </div>
                  <Tip>자연스러운 억양을 유지하며 읽어 보세요</Tip>
                </section>
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
