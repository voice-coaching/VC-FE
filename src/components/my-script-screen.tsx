"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PracticeSession } from "@/components/practice-session";
import { TopBar } from "@/components/top-bar";
import { SentenceReader } from "@/components/sentence-reader";
import { api, type PracticeContent } from "@/lib/api";
import { splitSentences } from "@/lib/sentences";
import { CUSTOM_SCRIPT_LIMIT } from "@/lib/custom-draft";

export function MyScriptScreen() {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"input" | "confirm" | "practice">("input");
  const [title, setTitle] = useState("연습하기");
  const [content, setContent] = useState<PracticeContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const request = useRef<{ text: string; key: string } | null>(null);
  const saveInFlight = useRef(false);
  const sentences = splitSentences(text);
  const characterCount = text.length;
  const tooLong = characterCount > CUSTOM_SCRIPT_LIMIT;

  async function startPractice() {
    if (saveInFlight.current || !text.trim() || tooLong) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    const script = text.trim().replace(/\s+/g, " ");
    if (request.current?.text !== script)
      request.current = { text: script, key: crypto.randomUUID() };
    try {
      const created = await api.content.createCustom(
        {
          title: "내 문장",
          scriptText: script,
          learningFocus: "PRONUNCIATION",
          retention: "SESSION_HISTORY",
          locale: "ko-KR",
        },
        request.current.key,
      );
      const saved = await api.content.get(created.id);
      setContent(saved);
      setStage("practice");
    } catch (reason) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "문장을 저장하지 못했습니다.",
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  if (stage === "practice" && content) {
    return (
      <AppShell
        nav={false}
        viewportLocked
        chromeColor="#f2f4f6"
        bottomChromeColor="#ffffff"
        className="flex flex-col !bg-[#f2f4f6]"
      >
        <TopBar to="/home" title={title} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PracticeSession
            content={content}
            experienceLabel="내 문장"
            onTitleChange={setTitle}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#f2f4f6"
      bottomChromeColor="#ffffff"
      className="flex flex-col !bg-[#f2f4f6]"
    >
      <TopBar
        to="/home"
        title="내 문장"
        onBack={stage === "confirm" ? () => setStage("input") : undefined}
      />

      {stage === "input" ? (
        <main className="min-h-0 flex-1 overflow-y-auto px-5 pt-3">
          <h2 className="text-[22px] leading-[30px] font-bold tracking-[-0.43px] text-[#191f28]">
            연습할 원고를 붙여넣어 주세요
          </h2>
          <p className="mt-1.5 text-[14px] leading-5 text-[#4e5968]">
            발표문, 대본, 자기소개서 등 무엇이든 좋아요
          </p>
          <label
            htmlFor="custom-script"
            className="mt-5 block text-[13px] leading-[18px] font-medium text-[#191f28]"
          >
            원고
          </label>
          <div
            className={`relative mt-2 h-[196px] rounded-xl bg-white ${tooLong ? "ring-2 ring-red-500" : "focus-within:ring-2 focus-within:ring-[#2f6bff]"}`}
          >
            <textarea
              id="custom-script"
              value={text}
              maxLength={CUSTOM_SCRIPT_LIMIT}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={tooLong}
              aria-describedby="custom-script-count custom-script-help"
              placeholder="여기에 원고를 붙여넣어 주세요"
              className="h-[calc(100%-40px)] w-full resize-none rounded-t-xl bg-transparent px-4 pt-3.5 text-[16px] leading-6 text-[#191f28] outline-none placeholder:text-[#b0b8c1]"
            />
            <span
              id="custom-script-count"
              className={`pointer-events-none absolute right-4 bottom-3.5 text-[12px] leading-4 font-medium ${tooLong ? "text-red-600" : "text-[#b0b8c1]"}`}
            >
              {characterCount}/{CUSTOM_SCRIPT_LIMIT}
            </span>
          </div>
          <p
            id="custom-script-help"
            className={`mt-2 text-[12px] leading-4 ${tooLong ? "text-red-600" : "text-[#4e5968]"}`}
          >
            {tooLong
              ? "원고는 300자 이내로 입력해 주세요."
              : text.trim()
                ? `${sentences.length}문장으로 나눠서 연습해요`
                : "문장 단위로 나눠서 연습해요"}
          </p>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-3 pb-4">
          <h2 className="text-[22px] leading-[30px] font-bold tracking-[-0.43px] text-[#191f28]">
            이렇게 나눠서 연습할게요
          </h2>
          <div className="mt-5 flex shrink-0 items-center">
            <p className="text-[14px] leading-5 font-medium text-[#4e5968]">
              전체 문장
            </p>
            <p className="ml-auto">
              <strong className="text-[16px] leading-6 text-[#2f6bff]">
                {sentences.length}
              </strong>
              <span className="ml-0.5 text-[13px] leading-[18px] font-medium text-[#4e5968]">
                문장
              </span>
            </p>
          </div>
          <SentenceReader sentences={sentences} className="mt-2 flex-1" />
        </main>
      )}

      <footer className="shrink-0 border-t border-[#e5e8eb] bg-white px-5 py-3">
        {saveError && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {saveError}
          </p>
        )}
        <button
          type="button"
          disabled={!text.trim() || tooLong || saving}
          onClick={() =>
            stage === "input" ? setStage("confirm") : void startPractice()
          }
          className="h-14 w-full rounded-full bg-[#2f6bff] text-[16px] leading-6 font-bold text-white disabled:bg-[#f2f4f6] disabled:text-[#b0b8c1]"
        >
          {stage === "input" ? "다음" : saving ? "저장 중…" : "저장하기"}
        </button>
      </footer>
    </AppShell>
  );
}
