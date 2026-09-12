"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { practiceCopy } from "@/lib/practice-copy";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BookOpen, TrendingUp, Trophy, UserRound } from "lucide-react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { AnnouncerRecordingReview } from "@/components/announcer-recording-review";
import { usePrototypeRecorder } from "@/hooks/use-prototype-recorder";
import { useSavePracticeCompletion } from "@/hooks/use-prototype-history";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { PracticeWave } from "@/components/practice-wave";
import transition from "@/components/prototype-analysis-flow.module.css";
import { PrototypeAnalysisFlow } from "@/components/prototype-analysis-flow";
import { NewsPreparation } from "./preparation";
import { NewsResult } from "./result";
import carousel from "./carousel.module.css";

// Fixed design fixtures, not a live news feed.
const ARTICLES = [
  {
    title: "한국은행 기준금리 3.5% 동결 결정",
    category: "경제",
    level: "중급",
    source: "연합뉴스",
    count: 5,
    minutes: 3,
    paragraphs: [
      "한국은행이 기준금리를 연 3.5퍼센트로 동결했습니다. 이번 결정은 여섯 차례 연속 동결입니다.",
      "금융통화위원회는 물가 상승세가 둔화되고 있다는 점을 근거로 들었습니다. 다만 가계부채 증가 속도는 여전히 부담이라고 덧붙였습니다.",
      "시장에서는 당분간 관망세가 이어질 것으로 보고 있습니다. 다음 회의는 다음 달 중순에 열립니다.",
    ],
  },
  {
    title: "서울시 청년 월세 지원 대상 확대",
    category: "사회",
    level: "초급",
    source: "서울신문",
    count: 4,
    minutes: 2,
    paragraphs: [
      "서울시가 청년 월세 지원 사업의 대상을 내년부터 확대한다고 밝혔습니다. 신청 연령 기준은 만 39세까지로 늘어납니다.",
      "지원 금액은 월 20만 원으로 최대 12개월간 받을 수 있습니다.",
      "신청은 다음 달 초부터 온라인으로 받습니다.",
    ],
  },
  {
    title: "국내 연구진 이차전지 수명 2배 기술 개발",
    category: "사회",
    level: "고급",
    source: "동아사이언스",
    count: 6,
    minutes: 4,
    paragraphs: [
      "국내 연구진이 이차전지의 수명을 두 배로 늘리는 기술을 개발했습니다. 새로운 소재로 전지 내부의 손상을 줄였습니다.",
      "연구진은 반복 충전 실험을 통해 성능을 확인했습니다. 기존 생산 공정에도 적용할 수 있다고 설명했습니다.",
      "이번 기술은 전기차 배터리 등에 활용될 전망입니다. 연구진은 추가 검증을 이어갈 계획입니다.",
    ],
  },
  {
    title: "프로야구 관중 1천만 명 돌파 눈앞",
    category: "스포츠",
    level: "초급",
    source: "스포츠서울",
    count: 4,
    minutes: 2,
    paragraphs: [
      "프로야구가 올 시즌 관중 1천만 명 돌파를 눈앞에 두고 있습니다. 지난 주말까지 누적 관중은 980만 명입니다.",
      "구단들은 남은 홈경기에서 기념 행사를 준비하고 있습니다.",
      "기록 달성은 이번 주 안에 이뤄질 전망입니다.",
    ],
  },
  {
    title: "가을 정기 공연 티켓 예매 시작",
    category: "문화",
    level: "중급",
    source: "문화일보",
    count: 5,
    minutes: 3,
    paragraphs: [
      "국립극장이 가을 정기 공연 티켓 예매를 시작했습니다. 올해는 전통 무용과 현대 음악을 함께 선보입니다.",
      "공연은 다음 달 첫째 주부터 3주 동안 이어집니다. 주말 회차는 조기 매진이 예상됩니다.",
      "예매는 극장 누리집에서 할 수 있습니다.",
    ],
  },
  {
    title: "전국 대부분 지역 낮 최고 27도",
    category: "사회",
    level: "초급",
    source: "기상뉴스",
    count: 4,
    minutes: 2,
    paragraphs: [
      "오늘은 전국 대부분 지역에서 맑은 날씨가 이어지겠습니다. 낮 최고 기온은 27도까지 오르겠습니다.",
      "아침과 저녁에는 선선한 바람이 불겠습니다.",
      "기상청은 큰 일교차에 대비해 건강 관리에 유의해 달라고 당부했습니다.",
    ],
  },
];
const press = "transition-transform duration-200 active:scale-[0.98]";
const card = "rounded-[18px] bg-white shadow-[0_2px_6px_rgba(23,23,23,0.05)]";
function Arrow({ left = false }: { left?: boolean }) {
  return (
    <Image
      src={`/figma/auth/chevron-${left ? "left" : "right"}.svg`}
      alt=""
      width={20}
      height={20}
    />
  );
}
function Tags({ article }: { article: (typeof ARTICLES)[number] }) {
  const Glyph =
    article.category === "경제"
      ? TrendingUp
      : article.category === "문화"
        ? BookOpen
        : article.category === "스포츠"
          ? Trophy
          : UserRound;
  return (
    <div className="flex gap-1.5 text-xs font-bold">
      <span
        className={`rounded-full px-[11px] py-[5px] ${article.level === "초급" ? "bg-[#e2f7ee] text-[#009b75]" : article.level === "고급" ? "bg-[#ffebe5] text-[#ff6347]" : "bg-[#e8eeff] text-[#2f6bff]"}`}
      >
        {article.level}
      </span>
      <span className="flex items-center gap-1 rounded-full bg-[#f2f4f6] px-2.5 py-[5px] text-[#4e5968]">
        <Glyph size={13} strokeWidth={1.8} />
        {article.category}
      </span>
    </div>
  );
}

export default function NewsPage({ today = false }: { today?: boolean }) {
  const saveCompletion = useSavePracticeCompletion();
  const router = useRouter();
  const [filter, setFilter] = useState("전체");
  const [selected, setSelected] = useState(0);
  const [slide, setSlide] = useState<{
    from: number;
    direction: number;
  } | null>(null);
  const sliding = useRef(false);
  const moveArticle = (direction: number) => {
    const next = selected + direction;
    if (sliding.current || next < 0 || next >= ARTICLES.length) return;
    sliding.current = true;
    setSlide({ from: selected, direction });
    setSelected(next);
  };
  const [screen, setScreen] = useState<
    "list" | "detail" | "prepare" | "practice" | "analysis" | "result"
  >(today ? "prepare" : "list");
  const recorder = usePrototypeRecorder();
  const article = ARTICLES[selected];
  const articleSentences =
    selected === 0
      ? [
          "한국은행이 기준금리를 연 3.5퍼센트로 동결했습니다.",
          "이번 결정은 여섯 차례 연속 동결입니다.",
          "물가 상승세가 둔화된 점이 반영됐습니다.",
          "시장은 당분간 관망세를 이어갈 전망입니다.",
          "다음 회의는 다음 달 중순에 열립니다.",
        ]
      : article.paragraphs.flatMap((paragraph) =>
          paragraph.split(/(?<=다\.)\s+/),
        );
  const sentences = today ? articleSentences.slice(0, 3) : articleSentences;
  const recording = recorder.status === "recording";
  const recorded = recorder.status === "recorded";
  const guard = useRecordingDiscardGuard(recording || recorded);
  const home = () =>
    router.push(
      `/home${process.env.NODE_ENV === "development" ? "?preview=1" : ""}`,
    );
  const back = () => {
    sliding.current = false;
    setSlide(null);
    if (screen === "practice") {
      recorder.reset();
      setScreen("prepare");
    } else if (screen === "prepare") {
      if (today) home();
      else setScreen("detail");
    } else if (screen === "detail") setScreen("list");
    else home();
  };
  const seconds = Math.floor(recorder.elapsedMs / 1000);
  if (screen === "analysis")
    return (
      <PrototypeAnalysisFlow
        onBack={() => setScreen("practice")}
        onComplete={() => setScreen("result")}
      />
    );
  if (screen === "result")
    return (
      <>
        {guard.dialog}
        <NewsResult
          sentences={sentences}
          onBack={() => setScreen("practice")}
          onRetry={() =>
            guard.request("retry", () => {
              recorder.reset();
              setScreen("practice");
            })
          }
          onFinish={() => {
            saveCompletion({
              mode: "news",
              title: article.title,
              sentenceCount: sentences.length,
              daily: today,
            });
            home();
          }}
        />
      </>
    );
  return (
    <IPhoneFrame>
      {guard.dialog}
      <section className="flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" />
        <header className="relative flex h-12 shrink-0 items-center justify-center">
          <button
            aria-label="뒤로 가기"
            onClick={() => guard.request("exit", back)}
            className={`${press} absolute left-2 flex size-10 items-center justify-center`}
          >
            <NavigationIcon />
          </button>
          <h1 className="text-[17px] font-bold">
            {screen === "practice"
              ? "연습하기"
              : screen === "prepare"
                ? "연습 준비"
                : "뉴스 읽기"}
          </h1>
        </header>
        <div
          key={screen}
          className={`${transition.enter} min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-5 [scrollbar-width:none]`}
        >
          {screen === "list" ? (
            <>
              <div className="flex gap-2 pt-3 pb-4" aria-label="뉴스 카테고리">
                {["전체", "사회", "경제", "문화", "스포츠"].map((category) => (
                  <button
                    key={category}
                    onClick={() => setFilter(category)}
                    aria-pressed={filter === category}
                    className={`${press} h-9 rounded-full border px-3 text-[15px] ${filter === category ? "border-[#2f6bff] bg-[#2f6bff] text-white" : "border-[#e5e8eb]"}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {ARTICLES.map((item, index) =>
                  filter === "전체" || item.category === filter ? (
                    <button
                      key={item.title}
                      onClick={() => {
                        setSelected(index);
                        setScreen("detail");
                      }}
                      className={`${card} ${press} flex w-full items-center gap-3 p-4 text-left`}
                    >
                      <div className="min-w-0 flex-1">
                        <Tags article={item} />
                        <h2 className="mt-2 text-base leading-6 font-bold">
                          {item.title}
                        </h2>
                        <p className="mt-2 text-xs text-[#8b95a1]">
                          {item.source} ㅣ {item.count}문장 ㅣ 약 {item.minutes}
                          분
                        </p>
                      </div>
                      <Arrow />
                    </button>
                  ) : null,
                )}
              </div>
            </>
          ) : screen === "prepare" ? (
            <NewsPreparation
              sentences={sentences}
              today={today}
              adapted={selected === 0}
            />
          ) : (
            <>
              {screen === "practice" && (
                <div className="flex items-center justify-between py-3">
                  <span className="rounded-full bg-[#edf2ff] px-2.5 py-[5px] text-xs font-bold text-[#143498]">
                    뉴스 읽기
                  </span>
                  <span className="text-xs text-[#8b95a1]">
                    {recorded
                      ? `${sentences.length}문장 녹음 완료`
                      : recording
                        ? "이어서 읽어주세요"
                        : `${sentences.length}문장 ㅣ 약 ${today ? 1 : article.minutes}분`}
                  </span>
                </div>
              )}
              {recorded && recorder.blob && recorder.previewUrl && (
                <AnnouncerRecordingReview
                  blob={recorder.blob}
                  url={recorder.previewUrl}
                  durationMs={recorder.durationMs}
                />
              )}
              {screen === "practice" ? (
                <>
                  {recorded && (
                    <h2 className="mt-5 mb-3 text-sm font-bold">읽은 문장</h2>
                  )}
                  <div className={`${card} mt-2 space-y-4 p-[18px]`}>
                    {sentences.map((sentence, index) => (
                      <p
                        key={sentence}
                        className={`text-base leading-6 font-medium transition-colors duration-500 ${recording && index !== Math.min(sentences.length - 1, Math.floor(seconds / 5)) ? "text-[#b0b8c1]" : "text-[#191f28]"}`}
                      >
                        {sentence}
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                <div
                  className={`${carousel.deck} mt-2`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {ARTICLES.map((entry, index) => (
                    <article
                      key={entry.title}
                      aria-hidden={index !== selected}
                      onAnimationEnd={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          index === selected
                        ) {
                          sliding.current = false;
                          setSlide(null);
                        }
                      }}
                      style={
                        {
                          "--direction": slide?.direction ?? 1,
                        } as React.CSSProperties
                      }
                      className={`${card} ${carousel.card} p-5 ${index === selected ? (slide ? carousel.incoming : carousel.current) : slide?.from === index ? carousel.outgoing : carousel.hidden}`}
                    >
                      <Tags article={entry} />
                      <h2 className="mt-3 text-[22px] leading-7 font-bold tracking-[-0.5px]">
                        {entry.title}
                      </h2>
                      <p className="mt-2 text-[13px] text-[#8b95a1]">
                        {entry.source} ㅣ{" "}
                        {index === 4 ? "2026.09.01" : "2026.09.02"}
                      </p>
                      <div className="mt-4 space-y-4 text-[15px] leading-[22px] text-[#4e5968]">
                        {entry.paragraphs.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {screen === "detail" && (
                <nav
                  aria-label="기사 이동"
                  className="mt-4 flex justify-between px-8 text-[13px] text-[#4e5968]"
                >
                  <button
                    disabled={selected === 0}
                    onClick={() => moveArticle(-1)}
                    className="flex h-11 items-center gap-1 disabled:opacity-30"
                  >
                    <Arrow left />
                    이전 기사
                  </button>
                  <button
                    disabled={selected === ARTICLES.length - 1}
                    onClick={() => moveArticle(1)}
                    className="flex h-11 items-center gap-1 disabled:opacity-30"
                  >
                    다음 기사
                    <Arrow />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
        {(screen === "detail" || screen === "prepare") && (
          <footer className="shrink-0 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-9">
            {screen === "detail" && (
              <p className="mb-2 text-center text-xs text-[#4e5968]">
                {article.count}문장 ㅣ 약 {article.minutes}분
              </p>
            )}
            <button
              onClick={() =>
                setScreen(screen === "detail" ? "prepare" : "practice")
              }
              className={`${press} h-14 w-full rounded-full bg-[#2f6bff] font-bold text-white`}
            >
              {screen === "detail"
                ? practiceCopy.listen
                : practiceCopy.recordScreen}
            </button>
          </footer>
        )}
        {screen === "practice" && (
          <footer className="shrink-0 px-5 pt-5 pb-9 text-center">
            {recorded ? (
              <div className="flex gap-2.5">
                <button
                  onClick={() => guard.request("retry", recorder.reset)}
                  className={`${press} h-14 flex-1 rounded-full border border-[#e5e8eb] bg-white font-bold`}
                >
                  {practiceCopy.retry}
                </button>
                <button
                  onClick={() => setScreen("analysis")}
                  className={`${press} h-14 flex-1 rounded-full bg-[#2f6bff] font-bold text-white`}
                >
                  {practiceCopy.analyze}
                </button>
              </div>
            ) : (
              <>
                {recording && (
                  <div className="mb-4">
                    <div
                      aria-hidden="true"
                      className="mb-3 flex h-12 items-center justify-center gap-1"
                    >
                      <PracticeWave active />
                    </div>
                    <p className="font-bold tabular-nums">
                      <span className="mr-2 text-red-600">●</span>
                      {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                      {String(seconds % 60).padStart(2, "0")}
                    </p>
                  </div>
                )}
                <button
                  aria-label={
                    recording ? practiceCopy.stop : practiceCopy.start
                  }
                  onClick={() =>
                    recording ? recorder.stop() : recorder.start()
                  }
                  className={`${press} mx-auto flex size-[76px] items-center justify-center rounded-full bg-[#2f6bff]`}
                >
                  {recording ? (
                    <span className="size-6 rounded-md bg-white" />
                  ) : (
                    <Image
                      src="/figma/announcer/record-mic.svg"
                      alt=""
                      width={28}
                      height={28}
                    />
                  )}
                </button>
                <p className="mt-4 text-sm text-[#4e5968]">
                  {recording ? practiceCopy.recording : practiceCopy.ready}
                </p>
              </>
            )}
          </footer>
        )}
      </section>
    </IPhoneFrame>
  );
}
