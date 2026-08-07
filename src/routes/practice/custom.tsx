"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { PracticeSession } from "@/components/practice-session";
import type { PracticeSentence } from "@/lib/app-data";

/** deterministic pseudo-scoring so the prototype feels consistent */
function buildSentence(script: string): PracticeSentence {
  const chars = script.split("");
  let i = 0;
  const syllables = chars.map((text) => {
    if (!text.trim()) return { text, score: 100 };
    const score = 55 + ((text.charCodeAt(0) * 7 + i++ * 13) % 45);
    return {
      text,
      score,
      note: score < 70 ? "이 음절이 흐리게 들려요. 입모양을 크게 해보세요." : undefined,
    };
  });
  const recognized = script
    .split(" ")
    .map((w, idx) => (idx % 4 === 3 ? w.replace(/.$/, "") : w))
    .join(" ");

  return {
    id: "custom",
    category: "custom",
    title: "내가 넣은 문장",
    announcer: "AI 아나운서 음성",
    script,
    recognized,
    syllables,
  };
}

export default function Custom() {
  const [text, setText] = useState("");
  const [sentence, setSentence] = useState<PracticeSentence | null>(null);

  return (
    <AppShell nav={false}>
      <TopBar to="/home" title="내 문장 연습" />
      {sentence ? (
        <PracticeSession sentence={sentence} />
      ) : (
        <div className="flex flex-col gap-5 px-5 pb-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              내 문장을 넣어서 연습하기
              <span className="ml-2 rounded-full bg-warning px-2 py-0.5 align-middle text-[10px] text-warning-foreground">
                BM
              </span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              발표문, 면접 답변, 대본을 붙여넣으면 AI 아나운서가 읽어주고 내 발음을 채점해요.
            </p>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="연습하고 싶은 문장을 입력하세요."
            className="w-full resize-none rounded-3xl bg-surface p-5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <div className="flex flex-wrap gap-2">
            {[
              "안녕하십니까, 오늘 발표를 맡은 이영욱입니다.",
              "저의 강점은 끈기와 소통 능력입니다.",
            ].map((s) => (
              <button
                key={s}
                onClick={() => setText(s)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                {s.slice(0, 14)}…
              </button>
            ))}
          </div>
          <button
            disabled={text.trim().length < 4}
            onClick={() => setSentence(buildSentence(text.trim()))}
            className="w-full rounded-full bg-foreground py-4 text-sm font-semibold text-background disabled:opacity-30"
          >
            이 문장으로 연습 시작
          </button>
        </div>
      )}
    </AppShell>
  );
}
