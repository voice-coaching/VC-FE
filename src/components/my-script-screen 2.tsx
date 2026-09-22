"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { PracticeSession } from "@/components/practice-session";
import { api, type PracticeContent } from "@/lib/api";

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
  const [content, setContent] = useState<PracticeContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const request = useRef<{ text: string; key: string } | null>(null);
  const mounted = useRef(true);
  const saveInFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function startPractice() {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    // Server rejects control characters; normalize pasted line breaks to spaces.
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
      if (!mounted.current) return;
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      setContent(saved);
      setStage("practice");
    } catch (reason) {
      if (mounted.current)
        setSaveError(
          reason instanceof Error
            ? reason.message
            : "문장을 저장하지 못했습니다.",
        );
    } finally {
      saveInFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }
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
    if (saving) return;
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
      {stage === "practice" && content ? (
        <PracticeSession content={content} onTitleChange={setTitle} />
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
            {saveError && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {saveError}
              </p>
            )}
            {stage === "preview" && (
              <p className="mb-3 text-xs text-muted-foreground">
                녹음을 시작하면 문장을 내 학습 기록용으로 서버에 저장합니다.
              </p>
            )}
            <button
              type="button"
              disabled={!text.trim() || saving}
              onClick={() => {
                if (stage === "input") setStage("confirm");
                else if (stage === "confirm") setStage("preview");
                else {
                  void startPractice();
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
                  : saving
                    ? "문장 저장 중…"
                    : "녹음 시작하기"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
