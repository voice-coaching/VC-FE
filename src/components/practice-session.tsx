"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  UploadCloud,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreBg, scoreColor, type PracticeSentence } from "@/lib/app-data";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { api, type AnalysisResult } from "@/lib/api";

type Phase = "idle" | "recording" | "review" | "analyzing" | "result" | "error";

function stripPunct(w: string) {
  return w.replace(/[.,?!]/g, "");
}

/** word-level diff between the script and the STT transcript */
function diffWords(script: string, recognized: string) {
  const s = script.split(" ");
  const r = recognized.split(" ");
  return s.map((word, i) => ({
    word,
    heard: r[i] ?? "(누락)",
    ok: stripPunct(r[i] ?? "") === stripPunct(word),
  }));
}

export function PracticeSession({ sentence }: { sentence: PracticeSentence }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);
  const recorder = useAudioRecorder();

  const marks = analysis?.syllables ?? sentence.syllables;
  const overall =
    analysis?.metrics.pronunciationScore ??
    Math.round(
      marks.filter((m) => m.text.trim()).reduce((a, b) => a + b.score, 0) /
        Math.max(1, marks.filter((m) => m.text.trim()).length),
    );
  const diff = diffWords(sentence.script, analysis?.recognized ?? sentence.recognized);
  const current = marks[cursor];

  useEffect(() => {
    if (!playing) return;
    if (cursor >= marks.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setCursor((c) => c + 1), 320);
    return () => clearTimeout(id);
  }, [playing, cursor, marks.length]);

  useEffect(() => {
    if (recorder.status === "recorded" && phase === "recording") setPhase("review");
    if (["denied", "unsupported", "error"].includes(recorder.status)) setPhase("error");
  }, [phase, recorder.status]);

  async function startRecording() {
    setRequestError(null);
    const started = await recorder.start();
    if (started) setPhase("recording");
  }

  async function analyze() {
    if (!recorder.blob) return;
    if (recorder.durationMs < 1_000) {
      setRequestError("분석하려면 1초 이상 녹음해 주세요.");
      return;
    }
    setPhase("analyzing");
    setUploadProgress(0);
    setRequestError(null);
    try {
      const result = await api.practice.analyze(
        {
          contentId: sentence.id,
          script: sentence.script,
          category: sentence.category,
          audio: recorder.blob,
          durationMs: recorder.durationMs,
        },
        { onUploadProgress: setUploadProgress },
      );
      if (!result.quality.analyzable) {
        setRequestError(result.quality.message ?? "음성 품질이 부족합니다. 다시 녹음해 주세요.");
        setPhase("review");
        return;
      }
      setAnalysis(result);
      setCursor(0);
      setPhase("result");
    } catch (reason) {
      setRequestError(reason instanceof Error ? reason.message : "음성 전송에 실패했습니다.");
      setPhase("review");
    }
  }

  async function playReference() {
    try {
      const { url } = await api.content.getReferenceAudio(sentence.id);
      if (url) return void new Audio(url).play();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(sentence.script);
        utterance.lang = "ko-KR";
        window.speechSynthesis.speak(utterance);
      }
    } catch (reason) {
      setRequestError(
        reason instanceof Error ? reason.message : "예시 음성을 재생하지 못했습니다.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-10">
      <section className="rounded-3xl bg-surface p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{sentence.title}</span>
          <button
            onClick={() => void playReference()}
            className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 font-medium text-foreground"
          >
            <Volume2 className="size-3.5" /> {sentence.announcer} 듣기
          </button>
        </div>
        <p className="mt-4 text-[22px] leading-[1.6] font-semibold tracking-tight">
          {sentence.script}
        </p>
      </section>

      {phase !== "result" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          {(phase === "idle" || phase === "recording") && (
            <button
              onClick={() => (phase === "recording" ? recorder.stop() : void startRecording())}
              disabled={recorder.status === "requesting"}
              className={cn(
                "flex size-24 items-center justify-center rounded-full transition-all",
                phase === "idle" && "bg-foreground text-background hover:scale-105",
                phase === "recording" && "animate-pulse bg-destructive text-destructive-foreground",
              )}
              aria-label={phase === "recording" ? "녹음 종료" : "녹음 시작"}
            >
              {phase === "recording" ? <Square className="size-8" /> : <Mic className="size-9" />}
            </button>
          )}

          {phase === "review" && recorder.previewUrl && (
            <div className="w-full rounded-3xl border border-border p-5">
              <p className="mb-3 text-sm font-semibold">녹음 미리 듣기</p>
              <audio controls src={recorder.previewUrl} className="w-full" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    recorder.reset();
                    setRequestError(null);
                    setPhase("idle");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border py-3 text-xs font-semibold"
                >
                  <RotateCcw className="size-4" /> 다시 녹음
                </button>
                <button
                  onClick={() => void analyze()}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground py-3 text-xs font-semibold text-background"
                >
                  <UploadCloud className="size-4" /> 분석 요청
                </button>
              </div>
            </div>
          )}

          {phase === "analyzing" && (
            <div className="w-full rounded-3xl bg-surface p-5 text-center">
              <p className="text-sm font-semibold">음성 전송 및 분석 중…</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {uploadProgress}% · 창을 닫지 말아 주세요
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="w-full rounded-3xl bg-destructive/10 p-5 text-center">
              <p className="text-sm font-semibold text-destructive">녹음을 시작할 수 없습니다</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{recorder.error}</p>
              <button
                onClick={() => {
                  recorder.reset();
                  setPhase("idle");
                }}
                className="mt-4 rounded-full border border-border px-5 py-2.5 text-xs font-semibold"
              >
                다시 시도
              </button>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {phase === "idle" &&
              (recorder.status === "requesting"
                ? "마이크 권한을 확인하고 있어요"
                : "아나운서를 따라 문장을 읽어보세요")}
            {phase === "recording" &&
              `녹음 중 ${Math.floor(recorder.elapsedMs / 60_000)}:${String(Math.floor(recorder.elapsedMs / 1000) % 60).padStart(2, "0")} · 버튼을 눌러 종료`}
          </p>
          {requestError && (
            <div
              role="alert"
              className="w-full rounded-2xl bg-destructive/10 px-4 py-3 text-center text-xs text-destructive"
            >
              {requestError}
              {phase === "review" && (
                <button onClick={() => void analyze()} className="ml-2 font-semibold underline">
                  재시도
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-border p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">종합 발음 점수</p>
                <p className="text-4xl font-bold tracking-tight">{overall}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>
                  정확도 {diff.filter((d) => d.ok).length}/{diff.length} 어절
                </p>
                <p className="mt-1">STT 기준 자동 채점</p>
              </div>
            </div>
            {analysis && (
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4 text-xs">
                <p>
                  <span className="text-muted-foreground">억양</span>
                  <br />
                  <b>{analysis.metrics.intonationScore ?? "-"}점</b>
                </p>
                <p>
                  <span className="text-muted-foreground">말하기 속도</span>
                  <br />
                  <b>
                    {analysis.metrics.speedWpm ?? "-"} WPM ·{" "}
                    {analysis.metrics.speedStatus === "good"
                      ? "적절"
                      : analysis.metrics.speedStatus === "fast"
                        ? "빠름"
                        : "느림"}
                  </b>
                </p>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold">내 발음 재생 · 음절 포커싱</h2>
            <div className="rounded-3xl bg-surface p-5">
              {recorder.previewUrl && (
                <audio controls src={recorder.previewUrl} className="mb-4 w-full" />
              )}
              <p className="text-[22px] leading-[1.9] font-semibold tracking-tight">
                {marks.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPlaying(false);
                      setCursor(i);
                    }}
                    className={cn(
                      "rounded-md px-0.5 transition-colors",
                      m.text.trim() && scoreBg(m.score),
                      m.text.trim() && scoreColor(m.score),
                      i === cursor && m.text.trim() && "bg-foreground! text-background! ",
                    )}
                  >
                    {m.text === " " ? "\u00A0" : m.text}
                  </button>
                ))}
              </p>

              <div className="mt-5 flex items-center justify-center gap-4">
                <button
                  onClick={() => {
                    setPlaying(false);
                    setCursor((c) => Math.max(0, c - 1));
                  }}
                  className="rounded-full bg-background p-2.5"
                  aria-label="이전 음절"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  onClick={() => {
                    if (cursor >= marks.length - 1) setCursor(0);
                    setPlaying((p) => !p);
                  }}
                  className="rounded-full bg-foreground p-3.5 text-background"
                  aria-label="재생"
                >
                  {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
                </button>
                <button
                  onClick={() => {
                    setPlaying(false);
                    setCursor((c) => Math.min(marks.length - 1, c + 1));
                  }}
                  className="rounded-full bg-background p-2.5"
                  aria-label="다음 음절"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-surface text-xl font-bold">
                  {current?.text.trim() ? current.text : "·"}
                </span>
                <div>
                  <p className={cn("text-sm font-semibold", scoreColor(current?.score ?? 100))}>
                    음절 점수 {current?.score ?? 100}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {current?.note ?? "이 음절은 스크립트와 일치해요."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold">STT 텍스트 vs 스크립트</h2>
            <div className="flex flex-wrap gap-x-2 gap-y-2 rounded-3xl border border-border p-5 text-[15px]">
              {diff.map((d, i) => (
                <span key={i} className="flex flex-col items-start">
                  <span
                    className={cn("font-semibold", d.ok ? "text-foreground" : "text-destructive")}
                  >
                    {d.heard}
                  </span>
                  {!d.ok && <span className="text-[11px] text-muted-foreground">→ {d.word}</span>}
                </span>
              ))}
            </div>
          </section>

          {analysis && (
            <section className="grid gap-3">
              <div className="rounded-3xl bg-success/10 p-5">
                <h2 className="text-sm font-semibold">이번 학습의 강점</h2>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                  {analysis.strengths.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-destructive/10 p-5">
                <h2 className="text-sm font-semibold">개선할 점과 추천 연습</h2>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                  {analysis.weaknesses.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <button
            onClick={() => {
              recorder.reset();
              setAnalysis(null);
              setPhase("idle");
              setCursor(0);
              setPlaying(false);
            }}
            className="w-full rounded-full bg-foreground py-4 text-sm font-semibold text-background"
          >
            다시 연습하기
          </button>
        </>
      )}
    </div>
  );
}
