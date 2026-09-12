"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { practiceCopy } from "@/lib/practice-copy";
import { IPhoneFrame } from "@/components/iphone-frame";
import { AnnouncerRecordingReview } from "@/components/announcer-recording-review";
import { PrototypeAnalysisFlow } from "@/components/prototype-analysis-flow";
import { usePrototypeRecorder } from "@/hooks/use-prototype-recorder";
import { useSavePracticeCompletion } from "@/hooks/use-prototype-history";
import { useRecordingDiscardGuard } from "@/hooks/use-recording-discard-guard";
import { splitCustomScript } from "@/lib/custom-script";
import { useCustomDraft } from "@/hooks/use-custom-draft";
import { countScriptCharacters, CUSTOM_SCRIPT_LIMIT } from "@/lib/custom-draft";
import { NewsPlayer } from "./news/player";
import { CustomPracticeResult } from "./custom-practice-result";
import { PracticeWave } from "@/components/practice-wave";
import transition from "@/components/prototype-analysis-flow.module.css";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type Screen = "input" | "split" | "listen" | "record" | "analysis" | "result";
const card =
  "rounded-[18px] bg-white p-[18px] shadow-[0_2px_6px_rgba(23,23,23,0.05)]";
const primary =
  "h-14 w-full rounded-full bg-[#2f6bff] font-bold text-white transition-transform active:scale-[0.98] disabled:bg-[#f2f4f6] disabled:text-[#b0b8c1]";

export default function CustomPractice() {
  const saveCompletion = useSavePracticeCompletion();
  const router = useRouter();
  const draft = useCustomDraft();
  const [deleteDraftOpen, setDeleteDraftOpen] = useState(false);
  const script = draft.text;
  const characterCount = useMemo(() => countScriptCharacters(script), [script]);
  const overLimit = characterCount > CUSTOM_SCRIPT_LIMIT;
  const [screen, setScreen] = useState<Screen>("input");
  const editor = useRef<HTMLTextAreaElement>(null);
  const focusEditor = useRef(false);
  useEffect(() => {
    if (screen === "input" && focusEditor.current) {
      editor.current?.focus();
      focusEditor.current = false;
    }
  }, [screen]);
  const [active, setActive] = useState(-1);
  const [seek, setSeek] = useState<{ position: number; id: number }>();
  const recorder = usePrototypeRecorder();
  const sentences = useMemo(() => splitCustomScript(script), [script]);
  const starts = useMemo(() => {
    const total =
      sentences.reduce((sum, sentence) => sum + sentence.length, 0) || 1;
    let offset = 0;
    return sentences.map((sentence) => {
      const start = (offset / total) * 26;
      offset += sentence.length;
      return start;
    });
  }, [sentences]);
  const updateSentence = useCallback(
    (position: number) => {
      let current = 0;
      starts.forEach((start, index) => {
        if (position >= start) current = index;
      });
      setActive(current);
    },
    [starts],
  );
  const home = () =>
    router.push(
      `/home${process.env.NODE_ENV === "development" ? "?preview=1" : ""}`,
    );
  const back = () => {
    if (screen === "input") return home();
    if (screen === "split") setScreen("input");
    else if (screen === "listen") setScreen("split");
    else {
      recorder.reset();
      setScreen("listen");
    }
    setActive(-1);
    setSeek(undefined);
  };
  const recording = recorder.status === "recording";
  const recorded = recorder.status === "recorded";
  const guard = useRecordingDiscardGuard(recording || recorded);
  const seconds = Math.floor(recorder.elapsedMs / 1000);
  if (screen === "analysis")
    return (
      <PrototypeAnalysisFlow
        onBack={() => setScreen("record")}
        onComplete={() => setScreen("result")}
      />
    );
  if (screen === "result")
    return (
      <>
        {guard.dialog}
        <CustomPracticeResult
          sentences={sentences}
          onBack={() => setScreen("record")}
          onRetry={() =>
            guard.request("retry", () => {
              recorder.reset();
              setActive(-1);
              setSeek(undefined);
              setScreen("record");
            })
          }
          onFinish={() => {
            saveCompletion({
              mode: "custom",
              title: "내 원고 연습",
              sentenceCount: sentences.length,
              daily: false,
            });
            home();
          }}
        />
      </>
    );
  return (
    <IPhoneFrame>
      {guard.dialog}
      <AlertDialog open={deleteDraftOpen} onOpenChange={setDeleteDraftOpen}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl bg-white">
          <AlertDialogTitle>원고와 임시 저장을 지울까요?</AlertDialogTitle>
          <AlertDialogDescription>
            삭제한 원고는 복구할 수 없어요. 필요한 내용은 먼저 복사해 주세요.
          </AlertDialogDescription>
          <AlertDialogCancel>계속 작성</AlertDialogCancel>
          <AlertDialogAction onClick={draft.discard}>
            원고 삭제
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
      <section className="flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" />
        <header className="relative flex h-12 shrink-0 items-center justify-center">
          <button
            aria-label="뒤로 가기"
            onClick={() => guard.request("exit", back)}
            className="absolute left-2 flex size-10 items-center justify-center active:opacity-50"
          >
            <NavigationIcon />
          </button>
          <h1 className="text-[17px] font-bold">
            {screen === "record" ? "연습하기" : "내 문장"}
          </h1>
        </header>
        <div
          key={screen}
          className={`${transition.enter} min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-5 [scrollbar-width:none]`}
        >
          {screen === "input" ? (
            <>
              <h2 className="text-xl font-bold">
                연습할 원고를 붙여넣어 주세요
              </h2>
              <p className="mt-1.5 text-xs text-[#8b95a1]">
                발표문, 대본, 자기소개서 등 무엇이든 좋아요
              </p>
              {draft.pending !== null && (
                <section
                  className="mt-4 rounded-2xl bg-[#edf2ff] p-4"
                  aria-label="임시 원고 복구"
                >
                  <h2 className="text-sm font-bold">작성하던 원고가 있어요</h2>
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-[#4e5968]">
                    {draft.pending}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={draft.restore}
                      className="min-h-11 flex-1 rounded-full bg-[#2f6bff] text-sm font-bold text-white"
                    >
                      이어서 작성
                    </button>
                    <button
                      onClick={() => setDeleteDraftOpen(true)}
                      className="min-h-11 flex-1 rounded-full bg-white text-sm font-bold text-[#4e5968]"
                    >
                      삭제하고 새로 쓰기
                    </button>
                  </div>
                </section>
              )}
              <label
                htmlFor="custom-script"
                className="mt-5 mb-2 block text-xs font-medium text-[#4e5968]"
              >
                원고
              </label>
              <div className="rounded-[18px] bg-white p-4 focus-within:ring-2 focus-within:ring-[#adc5ff]">
                <textarea
                  ref={editor}
                  id="custom-script"
                  value={script}
                  disabled={!draft.ready || draft.pending !== null}
                  onChange={(event) => draft.update(event.target.value)}
                  placeholder="여기에 원고를 붙여넣어 주세요"
                  aria-describedby="custom-count custom-hint custom-storage"
                  aria-invalid={overLimit}
                  className="h-[170px] w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-[#b0b8c1]"
                />
                <p
                  id="custom-count"
                  className="mt-2 text-right text-xs text-[#8b95a1] tabular-nums"
                >
                  {characterCount}/300
                </p>
              </div>
              <p
                id="custom-hint"
                hidden={!overLimit && !sentences.length}
                role="status"
                className={`mt-3 text-xs ${overLimit ? "text-[#ed243b]" : sentences.length ? "text-[#2f6bff]" : "text-[#8b95a1]"}`}
              >
                {overLimit
                  ? `${characterCount - CUSTOM_SCRIPT_LIMIT}자를 줄여 주세요. 붙여넣은 원고는 잘리지 않고 그대로 있어요.`
                  : sentences.length
                    ? `${sentences.length}문장으로 나눠서 연습해요`
                    : null}
              </p>
              <p
                id="custom-storage"
                hidden={draft.status !== "error"}
                className="mt-3 text-xs leading-5 text-[#8b95a1]"
              >
                {draft.status === "error"
                  ? "임시 저장을 사용할 수 없어요. 나가기 전에 원고를 복사해 주세요."
                  : null}
              </p>
              {script.length > 0 && (
                <button
                  onClick={() => setDeleteDraftOpen(true)}
                  className="mt-2 min-h-11 text-xs text-[#4e5968] underline underline-offset-4"
                >
                  원고와 임시 저장 지우기
                </button>
              )}
            </>
          ) : screen === "split" ? (
            <>
              <h2 className="text-xl font-bold">이렇게 나눠서 연습할게요</h2>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-[#4e5968]">
                  다르게 나뉘었다면 원고의 줄바꿈과 문장부호를 수정해 주세요.
                </p>
                <button
                  onClick={() => {
                    focusEditor.current = true;
                    setActive(-1);
                    setSeek(undefined);
                    setScreen("input");
                  }}
                  className="min-h-11 shrink-0 rounded-full bg-[#edf2ff] px-4 text-sm font-bold text-[#2f6bff]"
                >
                  원고 수정
                </button>
              </div>
              <div className="mt-5 mb-3 flex justify-between text-xs text-[#4e5968]">
                <span>전체 문장</span>
                <span className="font-bold text-[#2f6bff]">
                  {sentences.length}문장
                </span>
              </div>
              <ol className="space-y-2">
                {sentences.map((sentence, index) => (
                  <li
                    key={index}
                    className={`${card} flex gap-2 !p-3 text-sm leading-5`}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#edf2ff] text-[10px] font-bold text-[#2f6bff]">
                      {index + 1}
                    </span>
                    <span>{sentence}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : screen === "listen" ? (
            <>
              <h2 className="text-xl font-bold">먼저 들어볼까요?</h2>
              <p className="mt-1.5 mb-4 text-xs text-[#8b95a1]">
                읽는 속도와 끊어 읽는 위치를 확인해 보세요
              </p>
              <NewsPlayer
                duration={26}
                speedControl
                onPositionChange={updateSentence}
                seekRequest={seek}
              />
              <h2 className="mt-5 mb-3 text-sm font-bold">내 원고</h2>
              <ol className={`${card} space-y-1 !p-2.5`}>
                {sentences.map((sentence, index) => (
                  <li key={index}>
                    <button
                      aria-current={active === index ? "step" : undefined}
                      onClick={() => {
                        setActive(index);
                        setSeek((previous) => ({
                          position: starts[index],
                          id: (previous?.id ?? 0) + 1,
                        }));
                      }}
                      className={`flex min-h-11 w-full gap-2 rounded-xl p-2 text-left text-sm leading-5 transition-colors duration-300 motion-reduce:transition-none ${active === index ? "bg-[#edf2ff] text-[#191f28]" : "text-[#8b95a1]"}`}
                    >
                      <span
                        className={`text-xs ${active === index ? "text-[#2f6bff]" : ""}`}
                      >
                        {index + 1}
                      </span>
                      <span>{sentence}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : screen === "record" ? (
            <>
              <div className="mb-3.5 flex items-center justify-between">
                <span className="rounded-full bg-[#edf2ff] px-2.5 py-[5px] text-xs font-bold text-[#143498]">
                  내 문장
                </span>
                <span className="text-xs text-[#8b95a1]">
                  {recorded
                    ? `${sentences.length}문장 녹음 완료`
                    : recording
                      ? "이어서 읽어주세요"
                      : `${sentences.length}문장 ㅣ 약 ${Math.max(1, Math.ceil(script.length / 80))}분`}
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
              <div className={`${card} space-y-4`}>
                {sentences.map((sentence, index) => (
                  <p
                    key={index}
                    className={`text-base leading-6 font-medium transition-colors duration-500 ${recording && index !== Math.min(sentences.length - 1, Math.floor(seconds / 5)) ? "text-[#b0b8c1]" : ""}`}
                  >
                    {sentence}
                  </p>
                ))}
              </div>
            </>
          ) : null}
        </div>
        {screen === "record" && !recorded ? (
          <footer className="shrink-0 px-5 pt-5 pb-8 text-center">
            {recording && (
              <div className="mb-5">
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
              aria-label={recording ? practiceCopy.stop : practiceCopy.start}
              onClick={() => (recording ? recorder.stop() : recorder.start())}
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
            <p className="mt-4 text-sm text-[#4e5968]">
              {recording ? practiceCopy.recording : practiceCopy.ready}
            </p>
          </footer>
        ) : (
          <footer className="shrink-0 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-9">
            {screen === "record" ? (
              <div className="flex gap-2.5">
                <button
                  onClick={() => guard.request("retry", recorder.reset)}
                  className="h-14 flex-1 rounded-full border border-[#e5e8eb] font-bold"
                >
                  {practiceCopy.retry}
                </button>
                <button
                  onClick={() => setScreen("analysis")}
                  className={`${primary} flex-1`}
                >
                  {practiceCopy.analyze}
                </button>
              </div>
            ) : (
              <button
                disabled={
                  screen === "input" &&
                  (!sentences.length ||
                    overLimit ||
                    !draft.ready ||
                    draft.pending !== null)
                }
                onClick={() => {
                  if (screen === "input") {
                    if (
                      !sentences.length ||
                      overLimit ||
                      draft.pending !== null
                    )
                      return;
                    setScreen("split");
                  } else if (screen === "split") {
                    setActive(-1);
                    setSeek(undefined);
                    setScreen("listen");
                  } else if (screen === "listen") setScreen("record");
                  else home();
                }}
                className={primary}
              >
                {screen === "input"
                  ? "문장 확인하기"
                  : screen === "split"
                    ? practiceCopy.listen
                    : screen === "listen"
                      ? practiceCopy.recordScreen
                      : "연습 마치기"}
              </button>
            )}
          </footer>
        )}
      </section>
    </IPhoneFrame>
  );
}
