"use client";

import { useState } from "react";
import { MyScriptPreview } from "@/components/my-script-preview";
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
  function back() {
    setStage(stage === "preview" ? "confirm" : "input");
  }
  return (
    <AppShell
      nav={false}
      className={
        stage === "input"
          ? "my-script-input"
          : stage === "confirm"
            ? "my-script-confirm"
            : stage === "preview"
              ? "my-script-preview"
              : "my-script-practice"
      }
    >
      <TopBar
        to="/home"
        title={stage === "practice" ? title : "내 문장"}
        onBack={stage === "input" ? undefined : back}
      />
      {stage === "practice" ? (
        <PracticeSession content={content} localOnly onTitleChange={setTitle} />
      ) : (
        <div className="flex min-h-[calc(100dvh-92px)] flex-col">
          <div
            className={`space-y-5 px-5 pt-3 ${stage === "preview" ? "pb-5" : "pb-6"}`}
          >
            <div>
              <h2 className="text-2xl leading-9 font-bold">
                {stage === "input"
                  ? "연습할 원고를 붙여넣어 주세요"
                  : stage === "confirm"
                    ? "이렇게 나눠서 연습할게요"
                    : "먼저 들어볼까요?"}
              </h2>
              {stage !== "confirm" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {stage === "input"
                    ? "발표문, 대본, 자기소개서 등 무엇이든 좋아요"
                    : "읽는 속도와 끊어 읽는 위치를 확인해 보세요"}
                </p>
              )}
            </div>
            {stage === "input" ? (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="custom-script"
                  className="block text-[13px] leading-[18px] font-medium"
                >
                  원고
                </label>
                <div className="flex h-[196px] flex-col rounded-xl bg-white px-4 pt-3.5 pb-3 focus-within:ring-2 focus-within:ring-primary">
                  <textarea
                    id="custom-script"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={300}
                    placeholder="여기에 원고를 붙여넣어 주세요"
                    aria-describedby="custom-script-count custom-script-help"
                    className="min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-0 text-base leading-6 outline-none placeholder:text-[#b0b8c1]"
                  />
                  <p
                    id="custom-script-count"
                    className="mt-2 text-right text-xs leading-4 font-medium text-[#b0b8c1]"
                  >
                    {text.length}/300
                  </p>
                </div>
                <p
                  id="custom-script-help"
                  className="text-xs leading-4 text-[#4e5968]"
                >
                  {text.trim()
                    ? `${sentences.length}문장으로 나눠서 연습해요`
                    : "문장 단위로 나눠서 연습해요"}
                </p>
              </div>
            ) : stage === "confirm" ? (
              <section
                className="space-y-2"
                aria-labelledby="script-sentences-heading"
              >
                <div className="flex items-center justify-between text-[#4e5968]">
                  <h3
                    id="script-sentences-heading"
                    className="text-sm leading-5 font-medium tracking-[0.203px]"
                  >
                    전체 문장
                  </h3>
                  <p className="text-[13px] leading-[18px] font-medium tracking-[0.2522px]">
                    <span className="text-base leading-6 font-bold tracking-[0.0912px] text-primary">
                      {sentences.length}
                    </span>
                    문장
                  </p>
                </div>
                <ol className="space-y-2.5">
                  {sentences.map((sentence, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 rounded-xl bg-white p-3.5 shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#edf2ff] text-xs leading-4 font-bold tracking-[0.3024px] text-primary"
                      >
                        {index + 1}
                      </span>
                      <p className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium tracking-[0.144px] [overflow-wrap:anywhere]">
                        {sentence.trim()}
                      </p>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={() => setStage("input")}
                  className="text-sm text-primary"
                >
                  문장 수정하기
                </button>
              </section>
            ) : (
              <MyScriptPreview sentences={sentences} />
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
