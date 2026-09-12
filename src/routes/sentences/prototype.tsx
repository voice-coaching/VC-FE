"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { practiceCopy } from "@/lib/practice-copy";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { PrototypeAnalysisFlow } from "@/components/prototype-analysis-flow";
import { SentenceResult } from "@/components/sentence-result";
import { usePrototypeRecorder } from "@/hooks/use-prototype-recorder";
import { useSavePracticeCompletion } from "@/hooks/use-prototype-history";
import { PracticeWave as Wave } from "@/components/practice-wave";
import { PracticePlayer as PrototypePlayer } from "@/components/practice-player";

const FILTERS = ["전체", "받침", "된소리", "자음", "모음"];
const ITEMS = [
  {
    text: "맑은 하늘 아래 낚싯대를 드리웠다",
    level: "중급",
    type: "받침",
    count: 16,
    goal: "겹받침 ㄺ과 사이시옷을 끊어서 또렷하게 내는 연습이에요",
  },
  {
    text: "값진 경험이 삶을 넓게 만든다",
    level: "중급",
    type: "받침",
    count: 14,
    goal: "겹받침이 들어간 단어를 천천히 또렷하게 읽는 연습이에요",
  },
  {
    text: "깨끗한 그릇에 국수를 담았다",
    level: "초급",
    type: "된소리",
    count: 13,
    goal: "된소리와 예사소리의 차이를 구분하며 읽는 연습이에요",
  },
  {
    text: "쌀쌀한 날씨에 꽃샘추위가 찾아왔다",
    level: "고급",
    type: "된소리",
    count: 16,
    goal: "연속되는 된소리를 힘 있게 또렷하게 내는 연습이에요",
  },
  {
    text: "신속한 실행이 신뢰를 만든다",
    level: "초급",
    type: "자음",
    count: 13,
    goal: "혀의 위치를 의식하며 자음을 정확하게 내는 연습이에요",
  },
  {
    text: "외국어 회화 수업을 들으러 왔어요",
    level: "중급",
    type: "모음",
    count: 15,
    goal: "입 모양을 바꾸며 모음의 차이를 또렷하게 내는 연습이에요",
  },
];
const card = "rounded-2xl bg-white shadow-[0_2px_6px_rgba(23,23,23,0.05)]";
const press =
  "touch-manipulation transition-transform duration-200 active:scale-[0.98] motion-reduce:transition-none";
const formatTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

function Icon({
  name,
  size = 20,
  white = false,
}: {
  name: string;
  size?: number;
  white?: boolean;
}) {
  return (
    <Image
      src={`/figma/${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 ${white ? "brightness-0 invert" : ""}`}
    />
  );
}
function Level({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full px-[11px] py-[5px] text-xs leading-4 font-bold ${value === "초급" ? "bg-[#e4f7ee] text-[#0e8a5f]" : value === "고급" ? "bg-[#ffeae4] text-[#e0512f]" : "bg-[#e7eeff] text-[#2f5fe0]"}`}
    >
      {value}
    </span>
  );
}
export default function SentencesPage() {
  const saveCompletion = useSavePracticeCompletion();
  const router = useRouter();
  const [filter, setFilter] = useState("전체");
  const [selected, setSelected] = useState(0);
  const [screen, setScreen] = useState<"list" | "detail" | "practice">("list");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(false);
  const recorder = usePrototypeRecorder();
  const item = ITEMS[selected];
  const recording = recorder.status === "recording";
  const recorded = recorder.status === "recorded";
  const back = () => {
    if (screen === "practice") {
      recorder.reset();
      setScreen("detail");
    } else if (screen === "detail") setScreen("list");
    else {
      const preview =
        process.env.NODE_ENV === "development" &&
        new URLSearchParams(window.location.search).get("preview") === "1";
      router.push(`/home${preview ? "?preview=1" : ""}`);
    }
  };
  if (result)
    return (
      <SentenceResult
        sentence={item.text}
        onBack={() => setResult(false)}
        onRetry={() => {
          setResult(false);
          recorder.reset();
        }}
        onFinish={() => {
          saveCompletion({
            mode: "sentence",
            title: "한 문장 발음 연습",
            sentenceCount: 1,
            daily: false,
          });
          recorder.reset();
          router.push(
            `/home${process.env.NODE_ENV === "development" ? "?preview=1" : ""}`,
          );
        }}
      />
    );
  if (analyzing)
    return (
      <PrototypeAnalysisFlow
        onBack={() => setAnalyzing(false)}
        onComplete={() => {
          setAnalyzing(false);
          setResult(true);
        }}
      />
    );
  return (
    <IPhoneFrame>
      <section className="flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" />
        <header className="relative flex h-12 shrink-0 items-center justify-center">
          <button
            aria-label="뒤로 가기"
            onClick={back}
            className={`${press} absolute left-2 flex size-10 items-center justify-center`}
          >
            <NavigationIcon />
          </button>
          <h1 className="text-[17px] leading-6 font-bold">
            {screen === "practice" ? "연습하기" : "문장 연습"}
          </h1>
        </header>
        <div
          key={`${screen}-${selected}`}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 [scrollbar-width:none]"
        >
          {screen === "list" ? (
            <>
              <div className="flex gap-2 pt-3 pb-4" aria-label="문장 유형">
                {FILTERS.map((type) => (
                  <button
                    key={type}
                    aria-pressed={filter === type}
                    onClick={() => setFilter(type)}
                    className={`${press} h-9 rounded-full border px-3 text-[15px] ${filter === type ? "border-[#2f6bff] bg-[#2f6bff] text-white" : "border-[#e5e8eb]"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {ITEMS.map((sentence, index) =>
                  filter === "전체" || sentence.type === filter ? (
                    <button
                      key={sentence.text}
                      onClick={() => {
                        setSelected(index);
                        setScreen("detail");
                      }}
                      className={`${card} ${press} flex w-full items-center gap-3 p-4 text-left`}
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Level value={sentence.level} />
                          <span className="text-xs text-[#8b95a1]">
                            {sentence.type}
                          </span>
                        </div>
                        <p className="text-[17px] leading-6 font-bold">
                          {sentence.text}
                        </p>
                        <p className="text-[13px] leading-[18px] text-[#8b95a1]">
                          {sentence.count}음절
                        </p>
                      </div>
                      <Icon name="auth/chevron-right" />
                    </button>
                  ) : null,
                )}
              </div>
            </>
          ) : screen === "detail" ? (
            <div className="space-y-3.5 pt-3">
              <section
                className={`${card} rounded-[18px] px-5 py-7 text-center`}
              >
                <div className="mb-3.5 flex justify-center gap-1.5">
                  <span className="rounded-full bg-[#f2f4f6] px-[11px] py-[5px] text-xs font-bold text-[#4e5968]">
                    {item.type}
                  </span>
                  <Level value={item.level} />
                  <span className="rounded-full bg-[#f2f4f6] px-[11px] py-[5px] text-xs font-bold text-[#4e5968]">
                    {item.count}음절
                  </span>
                </div>
                <h2 className="mx-auto max-w-[240px] text-2xl leading-8 font-bold tracking-[-0.55px]">
                  {selected === 0 ? (
                    <>
                      맑은 하늘 아래
                      <br />
                      낚싯대를 드리웠다
                    </>
                  ) : (
                    item.text
                  )}
                </h2>
              </section>
              <section className={`${card} p-4`}>
                <h2 className="mb-1.5 text-[13px] leading-[18px] font-medium text-[#2f6bff]">
                  이 문장으로 무엇을 연습하나요
                </h2>
                <p className="text-[15px] leading-[22px] font-medium">
                  {item.goal}
                </p>
              </section>
              <PrototypePlayer />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pt-1 pb-3.5">
                <span className="inline-flex h-[26px] shrink-0 items-center rounded-full bg-[#edf2ff] px-2.5 py-[5px] text-[12px] leading-4 font-bold tracking-[0.3024px] text-[#143498]">
                  문장 연습
                </span>
                <span className="text-[13px] text-[#8b95a1]">
                  {recorded
                    ? "1문장 녹음 완료"
                    : recording
                      ? "천천히 읽어주세요"
                      : "1문장 ㅣ 약 10초"}
                </span>
              </div>
              {recorded && (
                <>
                  <PrototypePlayer review />
                  <h2 className="mt-[18px] mb-3.5 text-sm font-bold">
                    읽은 문장
                  </h2>
                </>
              )}
              <div
                className={`${card} p-[18px] text-base leading-6 font-medium`}
              >
                {item.text}
              </div>
            </>
          )}
        </div>
        {screen === "detail" && (
          <footer className="shrink-0 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-9">
            <button
              onClick={() => setScreen("practice")}
              className={`${press} h-14 w-full rounded-full bg-[#2f6bff] font-bold text-white`}
            >
              {practiceCopy.recordScreen}
            </button>
          </footer>
        )}
        {screen === "practice" &&
          (recorded ? (
            <footer className="shrink-0 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-9">
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    recorder.reset();
                  }}
                  className={`${press} h-14 flex-1 rounded-full border border-[#e5e8eb] font-bold`}
                >
                  {practiceCopy.retry}
                </button>
                <button
                  onClick={() => setAnalyzing(true)}
                  className={`${press} h-14 flex-1 rounded-full bg-[#2f6bff] font-bold text-white`}
                >
                  {practiceCopy.analyze}
                </button>
              </div>
            </footer>
          ) : (
            <footer className="shrink-0 px-5 pb-7 text-center">
              {recording && (
                <div className="mb-4">
                  <Wave active />
                  <p className="mt-5 flex items-center justify-center gap-2 font-bold tabular-nums">
                    <span className="size-2 rounded-full bg-[#d91b34]" />
                    {formatTime(recorder.elapsedMs / 1000)}
                  </p>
                </div>
              )}
              <button
                aria-label={recording ? practiceCopy.stop : practiceCopy.start}
                onClick={() => (recording ? recorder.stop() : recorder.start())}
                className={`${press} mx-auto flex size-[76px] items-center justify-center rounded-full bg-[#2f6bff]`}
              >
                {recording ? (
                  <span className="size-6 rounded-md bg-white" />
                ) : (
                  <Icon name="announcer/record-mic" size={32} />
                )}
              </button>
              <p className="mt-4 text-sm leading-5 font-medium text-[#4e5968]">
                {recording ? practiceCopy.recording : practiceCopy.ready}
              </p>
            </footer>
          ))}
      </section>
    </IPhoneFrame>
  );
}
