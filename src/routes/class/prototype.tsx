"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { practiceCopy } from "@/lib/practice-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { AnnouncerRecordingReview } from "@/components/announcer-recording-review";
import { usePrototypeRecorder } from "@/hooks/use-prototype-recorder";
import { useSavePracticeCompletion } from "@/hooks/use-prototype-history";
import { NewsPlayer } from "../news/player";
import motion from "@/components/announcer-result.module.css";
import transition from "@/components/prototype-analysis-flow.module.css";
import {
  completedAfterStep,
  parseClassProgress,
  pronunciationCourses,
  intonationCourses,
} from "./prototype-data";
import { IntonationDiagram } from "./intonation-diagram";
import segments from "./segments.module.css";

type Screen =
  "list" | "detail" | "principle" | "listen" | "record" | "result" | "complete";
const card =
  "rounded-2xl bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]";
const primary =
  "min-h-14 flex-1 rounded-full bg-[#2f6bff] px-4 font-bold text-white transition-transform active:scale-[0.98]";
const secondary =
  "min-h-14 flex-1 rounded-full border border-[#e5e8eb] px-4 font-bold transition-transform active:scale-[0.98]";

function Progress({ value, total }: { value: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-label="클래스 진행률"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      className="h-2 overflow-hidden rounded-full bg-[#e5e8eb]"
    >
      <div
        className="h-full rounded-full bg-[#2f6bff] transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${(value / total) * 100}%` }}
      />
    </div>
  );
}

function TongueDiagram() {
  const layers = [
    ["head", 106.5, 38.65, 152.277, 115.039],
    ["palate", 166.5, 97.47, 44, 8.533],
    ["spot", 164.5, 101, 10, 10],
    ["tongue", 130.5, 103.81, 45.61, 36.189],
    ["arrow", 132.5, 104, 30, 50],
    ["arrow-head", 158.5, 98, 10, 10],
  ] as const;
  return (
    <div
      role="img"
      aria-label="혀끝을 윗잇몸에 대는 위치 안내"
      className={`${card} relative h-[220px] !p-0`}
    >
      <div className="absolute left-1/2 h-full w-[362px] -translate-x-1/2">
        {layers.map(([name, left, top, width, height]) => (
          <Image
            key={name}
            src={`/figma/class/${name}.svg`}
            alt=""
            width={width}
            height={height}
            style={{ position: "absolute", left, top, width, height }}
          />
        ))}
        <p className="absolute top-[190px] w-full text-center text-xs font-bold text-[#2f6bff]">
          혀끝 → 윗잇몸
        </p>
      </div>
    </div>
  );
}

export default function PronunciationPrototype({
  mode: initialMode = "pronunciation",
}: {
  mode?: "pronunciation" | "intonation";
}) {
  const [mode, setMode] = useState(initialMode);
  const intonation = mode === "intonation";
  const saveCompletion = useSavePracticeCompletion();
  const courses = intonation ? intonationCourses : pronunciationCourses;
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("list");
  const [courseIndex, setCourseIndex] = useState(intonation ? 0 : 2);
  const [step, setStep] = useState(intonation ? 0 : 4);
  const [progressByMode, setProgressByMode] = useState(() => ({
    pronunciation: parseClassProgress(null, pronunciationCourses),
    intonation: parseClassProgress(null, intonationCourses),
  }));
  const progress = progressByMode[mode];
  const setProgress = (update: (values: number[]) => number[]) =>
    setProgressByMode((previous) => ({
      ...previous,
      [mode]: update(previous[mode]),
    }));
  const [loaded, setLoaded] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const recorder = usePrototypeRecorder(3_000);
  const course = courses[courseIndex];
  const total = course.steps.length;
  const completed = progress[courseIndex];
  const special = course.id === "final" && step === 4;
  const pitchType =
    course.id === "rising"
      ? "rising"
      : course.id === "stress"
        ? "stress"
        : "falling";
  const pitchAction =
    pitchType === "falling"
      ? "문장 끝에서 소리를 낮춰요"
      : pitchType === "rising"
        ? "문장 끝에서 소리를 올려요"
        : "핵심 단어에 힘을 실어요";
  const pitchFeedback =
    pitchType === "falling"
      ? "문장 끝 억양을 자연스럽게 낮췄어요"
      : pitchType === "rising"
        ? "문장 끝을 올려 물음을 표현했어요"
        : "핵심 단어를 자연스럽게 강조했어요";
  const recording = recorder.status === "recording";
  const recorded = recorder.status === "recorded";
  const home = () => router.push("/home?preview=1");

  useEffect(() => {
    try {
      setProgressByMode({
        pronunciation: parseClassProgress(
          localStorage.getItem("speakai:pronunciation-prototype:v1"),
          pronunciationCourses,
        ),
        intonation: parseClassProgress(
          localStorage.getItem("speakai:intonation-prototype:v1"),
          intonationCourses,
        ),
      });
    } catch {
      /* Storage is optional in private browsing. */
    }
    setLoaded(true);
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "pronunciation" || tab === "intonation") {
      setMode(tab);
      setCourseIndex(0);
      setStep(0);
    }
  }, []);
  useEffect(() => {
    if (loaded) {
      try {
        for (const type of ["pronunciation", "intonation"] as const)
          localStorage.setItem(
            `speakai:${type}-prototype:v1`,
            JSON.stringify(progressByMode[type]),
          );
      } catch {
        /* Keep the session usable. */
      }
    }
  }, [progressByMode, loaded]);

  function switchMode(next: "pronunciation" | "intonation") {
    if (next === mode) return;
    setMode(next);
    setCourseIndex(0);
    setStep(0);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function startStep(index: number) {
    recorder.reset();
    setAttempts(0);
    setStep(index);
    setScreen("principle");
  }
  function saveStepCompletion() {
    saveCompletion(
      {
        mode: "class",
        title: `${course.name} · ${step + 1}단계`,
        sentenceCount: 1,
        daily: false,
      },
      `${course.id}:${step}`,
    );
    setProgress((previous) =>
      previous.map((value, index) =>
        index === courseIndex ? completedAfterStep(value, step, total) : value,
      ),
    );
  }
  function nextStep() {
    saveStepCompletion();
    recorder.reset();
    if (step + 1 === total) setScreen("complete");
    else startStep(step + 1);
  }
  function back() {
    if (recording) {
      setExitOpen(true);
      return;
    }
    if (screen === "list") home();
    else if (screen === "detail" || screen === "complete") setScreen("list");
    else if (screen === "principle" || screen === "listen") setScreen("detail");
    else if (screen === "result") setScreen("record");
    else setScreen("listen");
  }
  const title =
    screen === "list"
      ? "클래스"
      : screen === "detail"
        ? course.name
        : screen === "principle" || screen === "listen"
          ? `${step + 1}단계`
          : screen === "result"
            ? "연습 결과"
            : "연습하기";
  const points = intonation
    ? [
        [
          pitchAction,
          pitchType === "falling"
            ? "마지막 음절을 살짝 내리듯 발음해요"
            : pitchType === "rising"
              ? "마지막 음절의 음높이를 가볍게 올려요"
              : "전달하고 싶은 단어를 살짝 길고 높게 말해요",
        ],
        [
          "속도를 천천히 줄여요",
          "문장 끝으로 갈수록 속도를 늦추면 자연스러워요",
        ],
        [
          "끝까지 힘을 유지해요",
          "소리가 흐려지지 않도록 마지막 음절도 또렷하게",
        ],
      ]
    : special
      ? [
          [
            "혀끝을 윗잇몸 뒤에 붙여요",
            "앞니 뒤쪽 잇몸에 혀끝을 가볍게 대주세요",
          ],
          [
            "혀를 떼면서 소리를 내요",
            "혀를 떼는 순간 “을” 소리가 자연스럽게 나요",
          ],
          [
            "끝까지 힘을 유지해요",
            "소리가 흐려지지 않도록 마지막까지 또렷하게",
          ],
        ]
      : [
          ["오늘의 소리를 확인해요", course.steps[step]],
          [
            "예시를 천천히 들어보세요",
            "소리의 차이와 입 모양을 생각하며 들어요",
          ],
          ["문장 끝까지 이어 읽어요", "일정한 속도로 또박또박 연습해요"],
        ];

  return (
    <IPhoneFrame>
      <section className="relative flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" />
        {screen !== "complete" && (
          <header className="relative flex h-12 shrink-0 items-center justify-center">
            <button
              onClick={back}
              aria-label={
                screen === "principle" || screen === "listen"
                  ? "단계 닫기"
                  : "뒤로 가기"
              }
              className="absolute left-2 flex size-10 items-center justify-center active:opacity-50"
            >
              {screen === "principle" || screen === "listen" ? (
                <NavigationIcon close />
              ) : (
                <NavigationIcon />
              )}
            </button>
            <h1 className="text-[17px] font-bold">{title}</h1>
            {(screen === "principle" || screen === "listen") && (
              <span className="absolute right-5 text-xs text-[#8b95a1]">
                {step + 1}/{total}
              </span>
            )}
          </header>
        )}
        <main
          key={screen === "list" ? "list" : `${screen}-${courseIndex}-${step}`}
          className={`${transition.enter} min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pt-3 pb-6 [scrollbar-width:none]`}
        >
          {screen === "list" ? (
            <>
              <div
                role="tablist"
                aria-label="클래스 종류"
                className={segments.segments}
              >
                <span
                  aria-hidden="true"
                  className={segments.indicator}
                  style={{ transform: `translateX(${intonation ? 100 : 0}%)` }}
                />
                {(["pronunciation", "intonation"] as const).map((type) => (
                  <button
                    key={type}
                    id={`class-tab-${type}`}
                    role="tab"
                    aria-selected={mode === type}
                    aria-controls={`class-panel-${type}`}
                    tabIndex={mode === type ? 0 : -1}
                    className={segments.tab}
                    onClick={() => switchMode(type)}
                    onKeyDown={(event) => {
                      if (
                        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          event.key,
                        )
                      )
                        return;
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? "pronunciation"
                          : event.key === "End"
                            ? "intonation"
                            : mode === "pronunciation"
                              ? "intonation"
                              : "pronunciation";
                      switchMode(next);
                      document.getElementById(`class-tab-${next}`)?.focus();
                    }}
                  >
                    {type === "pronunciation" ? "발음 클래스" : "억양 클래스"}
                  </button>
                ))}
              </div>
              <div className={segments.viewport}>
                <div className={segments.track}>
                  {(["pronunciation", "intonation"] as const).map(
                    (panelMode) => {
                      const panelCourses =
                        panelMode === "intonation"
                          ? intonationCourses
                          : pronunciationCourses;
                      return (
                        <div
                          key={panelMode}
                          id={`class-panel-${panelMode}`}
                          role="tabpanel"
                          aria-labelledby={`class-tab-${panelMode}`}
                          aria-hidden={mode !== panelMode}
                          inert={mode !== panelMode}
                          className={`${segments.panel} space-y-3`}
                        >
                          {panelCourses.map((item, index) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setCourseIndex(index);
                                setScreen("detail");
                              }}
                              className={`${card} flex w-full gap-3.5 text-left transition-transform active:scale-[0.985]`}
                            >
                              <span
                                className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${panelMode === "intonation" ? "" : "bg-[#ccddff]"}`}
                              >
                                <Image
                                  src={`/figma/class/${panelMode === "intonation" ? item.id : "icon"}.svg`}
                                  alt=""
                                  width={28}
                                  height={26}
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h2 className="text-[15px] font-bold">
                                    {item.name}
                                  </h2>
                                  <span
                                    className={`text-xs ${progressByMode[panelMode][index] ? "text-[#2f6bff]" : "text-[#8b95a1]"}`}
                                  >
                                    {progressByMode[panelMode][index]}/
                                    {item.steps.length}
                                  </span>
                                </div>
                                <p className="mt-1 mb-3 text-xs text-[#8b95a1]">
                                  {item.description}
                                </p>
                                <Progress
                                  value={progressByMode[panelMode][index]}
                                  total={item.steps.length}
                                />
                                <p className="mt-2 text-[11px] text-[#8b95a1]">
                                  {item.level} ㅣ {item.steps.length}단계 ㅣ 약{" "}
                                  {item.minutes}분
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </>
          ) : screen === "detail" ? (
            <>
              <div className="mb-3 flex gap-1.5 text-xs font-bold">
                <span
                  className={`rounded-full px-2.5 py-1 ${intonation && course.level === "초급" ? "bg-[#e2f7ef] text-[#009c73]" : "bg-[#e7eeff] text-[#2f6bff]"}`}
                >
                  {course.level}
                </span>
                <span className="rounded-full bg-[#f2f4f6] px-2.5 py-1">
                  {total}단계
                </span>
                <span className="rounded-full bg-[#f2f4f6] px-2.5 py-1">
                  약 {course.minutes}분
                </span>
              </div>
              <h2 className="text-xl font-bold">{course.description}</h2>
              <p className="mt-2 text-sm leading-5 text-[#4e5968]">
                {course.name.replace(" 클래스", "")}을 {total}단계로 나눠
                연습해요
              </p>
              <div className={`${card} mt-4`}>
                {completed || intonation ? (
                  <>
                    <p className="mb-3 flex justify-between text-xs">
                      진행 상황
                      <span className="font-bold text-[#2f6bff]">
                        {completed}/{total}단계
                      </span>
                    </p>
                    <Progress value={completed} total={total} />
                    <p className="mt-3 text-xs text-[#4e5968]">
                      {completed === total
                        ? "모든 단계를 마쳤어요. 다시 복습할 수 있어요"
                        : `다음: ${course.steps[completed]}`}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-bold">이 클래스를 마치면</h3>
                    <p className="mt-2 text-xs text-[#4e5968]">
                      소리를 또렷하게 구분해 발음할 수 있어요
                    </p>
                  </>
                )}
              </div>
              <h2 className="mt-5 mb-3 flex justify-between text-sm font-bold">
                구성 단계
                <span className="text-xs font-normal text-[#8b95a1]">
                  {total}단계
                </span>
              </h2>
              <ol className={`${card} divide-y divide-[#e5e8eb] !py-1`}>
                {course.steps.map((label, index) => (
                  <li key={label}>
                    <button
                      disabled={index > completed}
                      onClick={() => startStep(index)}
                      className="flex min-h-14 w-full items-center gap-3 text-left text-sm disabled:text-[#b0b8c1]"
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${index < completed ? "bg-[#2f6bff] text-white" : index === completed ? "border border-[#2f6bff] text-[#2f6bff]" : "bg-[#f2f4f6]"}`}
                      >
                        {index < completed ? "✓" : index + 1}
                      </span>
                      <span className="flex-1">{label}</span>
                      {index <= completed && (
                        <Image
                          src="/figma/auth/chevron-right.svg"
                          alt=""
                          width={16}
                          height={16}
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : screen === "principle" ? (
            <>
              <Progress value={intonation ? step + 1 : step} total={total} />
              <h2 className="mt-5 text-[22px] leading-[30px] font-bold">
                {intonation
                  ? pitchAction
                  : special
                    ? "받침 ㄹ, 이렇게 소리 내요"
                    : course.steps[step]}
              </h2>
              <p className="mt-1 mb-5 text-sm text-[#4e5968]">
                {intonation
                  ? "음높이만 살짝 바꿔도 자연스러운 억양이 돼요"
                  : special
                    ? "혀의 위치만 바꿔도 또렷하게 들려요"
                    : "소리를 구분하고 천천히 따라 해보세요"}
              </p>
              {special && <TongueDiagram />}
              {intonation && <IntonationDiagram type={pitchType} />}
              <ol className={`${card} mt-5 divide-y divide-[#e5e8eb] !py-1`}>
                {points.map(([heading, description], index) => (
                  <li key={heading} className="flex gap-3 py-4">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#edf2ff] text-xs font-bold text-[#2f6bff]">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-[15px] font-bold">{heading}</h3>
                      <p className="mt-1 text-[13px] leading-[18px] text-[#4e5968]">
                        {description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : screen === "listen" ? (
            <>
              <Progress value={intonation ? step + 1 : step} total={total} />
              <h2 className="mt-5 text-xl font-bold">
                예시를 듣고 따라 해보세요
              </h2>
              <p className="mt-1 mb-5 text-sm text-[#8b95a1]">
                {special
                  ? "받침 ㄹ 소리에 집중해서 들어보세요"
                  : course.steps[step]}
              </p>
              <NewsPlayer duration={3} />
              <h2 className="mt-5 mb-3 text-sm font-bold">연습 문장</h2>
              <p className={`${card} text-center text-base font-bold`}>
                {course.sentence}
              </p>
            </>
          ) : screen === "record" ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-[#edf2ff] px-2.5 py-[5px] text-xs font-bold text-[#143498]">
                  {intonation ? "억양 클래스" : "발음 클래스"}
                </span>
                <span className="text-xs text-[#8b95a1]">
                  {recorded
                    ? "1문장 녹음 완료"
                    : recording
                      ? intonation
                        ? pitchAction
                        : "받침 끝이 뭉개지지 않게 읽어주세요"
                      : "1문장 ㅣ 약 8초"}
                </span>
              </div>
              {recorded && recorder.blob && recorder.previewUrl && (
                <>
                  <AnnouncerRecordingReview
                    blob={recorder.blob}
                    url={recorder.previewUrl}
                    durationMs={recorder.durationMs}
                  />
                  <h2 className="mt-5 mb-3 text-sm font-bold">읽은 문장</h2>
                </>
              )}
              <p className={`${card} text-base leading-6 font-medium`}>
                {course.sentence}
              </p>
            </>
          ) : screen === "result" ? (
            <>
              <section className="rounded-[18px] bg-[linear-gradient(145deg,#2a63f6,#5e8cff)] p-5 text-white shadow-lg shadow-blue-700/15">
                <div className="flex justify-between text-xs text-white/70">
                  <span>{intonation ? "억양 정확도" : "발음 정확도"}</span>
                  <span className="rounded-full bg-white/20 px-2 py-1 text-white">
                    좋음
                  </span>
                </div>
                <p className="mt-2">
                  <strong className="text-[40px] leading-[52px]">
                    {intonation ? 84 : 88}
                  </strong>
                  점
                </p>
                <p className="mt-4 text-sm">
                  {intonation
                    ? pitchFeedback
                    : special
                      ? "받침 ㄹ 소리를 또렷하게 냈어요"
                      : "문장을 또렷하게 읽었어요"}
                </p>
                <NewsPlayer duration={3} compact />
              </section>
              <h2 className="mt-5 mb-4 text-sm font-bold">
                {intonation
                  ? "문장 끝 억양 확인"
                  : special
                    ? "받침 ㄹ 소리 확인"
                    : course.steps[step]}
              </h2>
              {intonation && (
                <div className="mb-4">
                  <IntonationDiagram type={pitchType} result />
                </div>
              )}
              <div className="rounded-xl bg-[#e5f5ee] p-4 text-sm">
                <strong>
                  {intonation
                    ? pitchFeedback
                    : special
                      ? "혀끝을 잘 붙였다 뗐어요"
                      : "문장 끝까지 잘 읽었어요"}
                </strong>
                <p className="mt-1 text-xs text-[#4e5968]">
                  {attempts}번째 연습을 마쳤어요
                </p>
              </div>
              <div className="mt-4 flex gap-2 rounded-xl bg-[#edf2ff] p-4 text-xs leading-5 text-[#3659ad]">
                <Image
                  src="/figma/announcer/ai-sparkle.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="size-5"
                />
                <div>
                  <strong>다음에도 이렇게 해보세요</strong>
                  <p>
                    {intonation
                      ? "문장 끝 음절의 속도를 조금 더 천천히 해보세요"
                      : "문장 끝까지 힘을 유지하면 더 좋아져요"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-full flex-col justify-center pt-20 pb-8 text-center">
              <Image
                src="/figma/class/badge.svg"
                alt="클래스 완료"
                width={200}
                height={200}
                className="mx-auto mb-6 size-[200px] shrink-0"
              />
              <h2 className="text-xl font-bold">{course.name}를 완료했어요</h2>
              <p className="mt-2 text-sm text-[#4e5968]">
                {total}단계를 모두 마쳤어요
              </p>
              <div
                className={`${card} mx-3 mt-6 grid grid-cols-3 divide-x divide-[#e5e8eb] px-2`}
              >
                {[
                  [intonation ? "84점" : "88점", "평균 점수"],
                  [`${Math.round(course.minutes * 0.75)}분`, "연습 시간"],
                  [`${total}개`, "연습 문장"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <strong className="text-lg">{value}</strong>
                    <p className="mt-1 text-[11px] text-[#8b95a1]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
        {screen === "list" ? (
          <nav className="flex shrink-0 border-t border-[#e5e8eb] bg-white pt-2 pb-8">
            {[
              ["/home?preview=1", "홈", "tab-home"],
              ["/class", "클래스", "tab-class"],
              ["/mypage?preview=1", "마이", "tab-my"],
            ].map(([href, label, icon]) => (
              <Link
                key={href}
                href={href}
                aria-current={label === "클래스" ? "page" : undefined}
                className={`flex min-h-12 flex-1 flex-col items-center gap-1 text-xs ${label === "클래스" ? "font-bold text-[#2f6bff]" : "text-[#8b95a1]"}`}
              >
                <Image
                  src={`/figma/home/${icon}.svg`}
                  alt=""
                  width={24}
                  height={24}
                />
                {label}
              </Link>
            ))}
          </nav>
        ) : screen === "record" && !recorded ? (
          <footer className="shrink-0 px-5 pt-5 pb-8 text-center">
            {recording && (
              <>
                <div
                  aria-hidden="true"
                  className="mb-3 flex h-14 items-center justify-center gap-1"
                >
                  {Array.from({ length: 20 }, (_, index) => (
                    <span
                      key={index}
                      className={`${motion.bar} w-1 rounded-full bg-[#2f6bff]`}
                      style={{
                        height: 12 + ((index * 13) % 32),
                        animationDelay: `${index * -73}ms`,
                      }}
                    />
                  ))}
                </div>
                <p className="mb-5 text-sm font-bold tabular-nums">
                  <span className="mr-2 text-red-600">●</span>
                  {String(Math.floor(recorder.elapsedMs / 60000)).padStart(
                    2,
                    "0",
                  )}
                  :
                  {String(Math.floor(recorder.elapsedMs / 1000) % 60).padStart(
                    2,
                    "0",
                  )}
                </p>
              </>
            )}
            <button
              aria-label={recording ? practiceCopy.stop : practiceCopy.start}
              onClick={() => {
                if (recording) recorder.stop();
                else {
                  setAttempts((value) => value + 1);
                  recorder.start();
                }
              }}
              className="mx-auto flex size-[76px] items-center justify-center rounded-full bg-[#2f6bff] transition-transform active:scale-95"
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
            <p className="mt-5 text-sm text-[#4e5968]">
              {recording ? practiceCopy.recording : practiceCopy.ready}
            </p>
          </footer>
        ) : (
          <footer
            className={`flex shrink-0 gap-2.5 px-5 pt-3 pb-8 ${screen === "complete" ? "flex-col bg-[#fafbfc]" : "border-t border-[#e5e8eb] bg-white"}`}
          >
            {screen === "detail" ? (
              <button
                className={primary}
                onClick={() => startStep(completed === total ? 0 : completed)}
              >
                {completed === total
                  ? "다시 복습하기"
                  : completed
                    ? "이어서 연습하기"
                    : "연습 시작하기"}
              </button>
            ) : screen === "principle" ? (
              <button className={primary} onClick={() => setScreen("listen")}>
                예시 들어보기
              </button>
            ) : screen === "listen" ? (
              <button
                className={primary}
                onClick={() => {
                  recorder.reset();
                  setScreen("record");
                }}
              >
                {practiceCopy.recordScreen}
              </button>
            ) : screen === "record" ? (
              <>
                <button className={secondary} onClick={recorder.reset}>
                  {practiceCopy.retry}
                </button>
                <button className={primary} onClick={() => setScreen("result")}>
                  {practiceCopy.analyze}
                </button>
              </>
            ) : screen === "result" ? (
              <>
                <button
                  className={secondary}
                  onClick={() => {
                    recorder.reset();
                    setScreen("record");
                  }}
                >
                  {practiceCopy.retry}
                </button>
                <button className={primary} onClick={nextStep}>
                  {step + 1 === total ? "클래스 완료하기" : "다음 단계로"}
                </button>
              </>
            ) : (
              <>
                <button className={primary} onClick={() => setScreen("list")}>
                  다른 클래스 보기
                </button>
                <button className={secondary} onClick={home}>
                  홈으로
                </button>
              </>
            )}
          </footer>
        )}
        {exitOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-6">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="class-exit-title"
              className={`${card} w-full`}
            >
              <h2 id="class-exit-title" className="text-lg font-bold">
                녹음을 그만할까요?
              </h2>
              <p className="mt-2 text-sm text-[#4e5968]">
                현재 녹음은 남지 않지만 완료한 단계는 유지돼요.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  autoFocus
                  className={secondary}
                  onClick={() => setExitOpen(false)}
                >
                  계속 읽기
                </button>
                <button
                  className={primary}
                  onClick={() => {
                    recorder.reset();
                    setExitOpen(false);
                    setScreen("detail");
                  }}
                >
                  그만하기
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </IPhoneFrame>
  );
}
