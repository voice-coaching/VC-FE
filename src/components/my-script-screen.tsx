"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { PracticeSession } from "@/components/practice-session";
import type { PracticeContent } from "@/lib/api";

export function MyScriptScreen() {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<
    "input" | "confirm" | "preview" | "practice"
  >("input");
  const [title, setTitle] = useState("연습하기");
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );
  const sentences =
    text
      .trim()
      .match(/[^.!?。！？]+[.!?。！？]*/g)
      ?.filter((value) => value.trim()) ?? [];
  const content: PracticeContent = {
    id: "local-script",
    contentType: "SENTENCE",
    title: "내 문장",
    category: "내 문장",
    difficulty: "INTERMEDIATE",
    estimatedSeconds: Math.max(15, text.length / 4),
    learningFocus: "BOTH",
    description: "직접 입력한 문장으로 연습해요",
    scriptText: text.trim(),
    targetPronunciations: [],
    referenceAudioAvailable: false,
  };
  function listen() {
    if (!("speechSynthesis" in window)) {
      setSpeechError("이 브라우저에서는 미리 듣기를 지원하지 않습니다.");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    setSpeechError(null);
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = "ko-KR";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechError("미리 듣기를 재생하지 못했습니다.");
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }
  function back() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setStage(stage === "preview" ? "confirm" : "input");
  }
  return (
    <AppShell nav={false}>
      <TopBar
        to="/home"
        title={stage === "practice" ? title : "내 문장"}
        onBack={stage === "input" ? undefined : back}
      />
      {stage === "practice" ? (
        <PracticeSession content={content} localOnly onTitleChange={setTitle} />
      ) : (
        <div className="flex min-h-[calc(100dvh-80px)] flex-col">
          <div className="space-y-5 px-5 pb-6">
            <div>
              <h2 className="text-2xl leading-9 font-bold">
                {stage === "input"
                  ? "연습할 원고를 붙여넣어 주세요"
                  : stage === "confirm"
                    ? "이렇게 나눠서 연습할게요"
                    : "먼저 들어볼까요?"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {stage === "input"
                  ? "발표문, 대본, 자기소개서 등 무엇이든 좋아요"
                  : "읽는 속도와 끊어 읽는 위치를 확인해 보세요"}
              </p>
            </div>
            {stage === "input" ? (
              <>
                <label
                  htmlFor="custom-script"
                  className="block text-sm font-semibold"
                >
                  원고
                </label>
                <textarea
                  id="custom-script"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={300}
                  placeholder="여기에 원고를 붙여넣어 주세요"
                  className="min-h-72 w-full resize-y rounded-2xl border border-border bg-white p-5 text-base leading-7 outline-primary"
                />
                <p className="text-right text-xs text-muted-foreground">
                  {text.length}/300
                </p>
                <p className="text-xs text-muted-foreground">
                  {text.trim()
                    ? `${sentences.length}문장으로 나눠서 연습해요`
                    : "문장 단위로 나눠서 연습해요"}
                </p>
              </>
            ) : (
              <>
                {stage === "preview" && (
                  <section className="design-card">
                    <h3 className="text-sm font-semibold">미리 듣기</h3>
                    <div
                      className="my-6 flex h-10 items-center justify-center gap-1"
                      aria-hidden="true"
                    >
                      {[
                        12, 22, 30, 18, 36, 24, 40, 20, 32, 18, 28, 38, 20, 14,
                        26,
                      ].map((height, index) => (
                        <span
                          key={index}
                          className={`w-1 rounded-full ${speaking ? "bg-primary" : "bg-border"}`}
                          style={{ height }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="design-action !min-h-12 !rounded-xl"
                      onClick={listen}
                    >
                      {speaking ? (
                        <Pause className="size-4" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      {speaking ? "멈추기" : "재생"}
                    </button>
                    {speechError && (
                      <p role="alert" className="mt-3 text-xs text-destructive">
                        {speechError}
                      </p>
                    )}
                  </section>
                )}
                <div className="flex justify-between text-sm">
                  <h3 className="font-semibold">연습 문장</h3>
                  <span className="text-muted-foreground">
                    {sentences.length}문장
                  </span>
                </div>
                <ol className="design-card space-y-5">
                  {sentences.map((sentence, index) => (
                    <li key={index} className="flex gap-3 text-base leading-7">
                      <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      {sentence.trim()}
                    </li>
                  ))}
                </ol>
                {stage === "confirm" && (
                  <button
                    type="button"
                    onClick={() => setStage("input")}
                    className="text-sm text-primary"
                  >
                    문장 수정하기
                  </button>
                )}
              </>
            )}
          </div>
          <div className="design-dock">
            <button
              type="button"
              disabled={!text.trim()}
              onClick={() => {
                if (stage === "input") setStage("confirm");
                else if (stage === "confirm") setStage("preview");
                else {
                  if ("speechSynthesis" in window)
                    window.speechSynthesis.cancel();
                  setSpeaking(false);
                  setStage("practice");
                }
              }}
              className="design-action"
            >
              {stage === "input"
                ? text.trim()
                  ? "문장 확인하기"
                  : "다음"
                : stage === "confirm"
                  ? "연습 시작하기"
                  : "녹음 시작하기"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
