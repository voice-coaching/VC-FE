"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { AnalysisView } from "@/components/analysis-view";
import { SentenceResultTabs } from "@/components/sentence-result-tabs";
import { TopBar } from "@/components/top-bar";
import { SegmentTabs } from "@/components/segment-tabs";
import { RESULTS, SENTENCES, result } from "../sentence-results/preview";

/*
 * Dev-only mock of a learning-history detail for a multi-sentence practice
 * (none exists in real data yet). Recording tab: listening comes first, each
 * sentence has its own play button, plus one to play every take in order.
 * Playback is simulated with a clock; scores live in the AI report tab. AI report tab: the same per-sentence
 * result tabs as the live result screen.
 */

const ALL = [
  ...RESULTS,
  result(
    4,
    76.8,
    "끊어 읽기가 정확해요. '누리집에서'의 첫 음절을 조금 더 또렷하게 내 보세요.",
    [86.0, 70.2, 72.5, 80.4, 66.1, 71.8],
  ),
];

export function HistoryMultiPreview() {
  const [tab, setTab] = useState<"recording" | "report">("recording");
  const [playback, setPlayback] = useState<Playback | null>(null);
  usePlaybackClock(playback, setPlayback);
  const toggle = (index: number) =>
    setPlayback((current) =>
      current?.index === index && !current.all
        ? null
        : { index, elapsed: 0, all: false },
    );
  const [reportActive, setReportActive] = useState(0);

  return (
    <main className="mx-auto flex h-dvh max-w-[402px] flex-col bg-[#f2f4f6]">
      <div className="shrink-0 bg-white">
        <TopBar to="/mypage/history" title="뉴스 읽기" />
        <SegmentTabs
          className="mx-5"
          tabs={
            [
              ["recording", "녹음"],
              ["report", "AI 리포트"],
            ] as const
          }
          active={tab}
          onSelect={setTab}
        />
      </div>

      {tab === "recording" ? (
        <>
          <div className="app-tab-panel min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
            <section className="rounded-[20px] bg-white px-[18px] py-2">
              <ol className="divide-y divide-[#f2f4f6]">
                {SENTENCES.map((sentence, index) => {
                  const on = playback?.index === index;
                  const progress = on ? playback.elapsed / DURATIONS[index] : 0;
                  return (
                    <li key={sentence}>
                      <button
                        type="button"
                        aria-label={`${index + 1}번 문장 ${on ? "멈추기" : "내 녹음 듣기"}`}
                        onClick={() => toggle(index)}
                        className="flex w-full items-center gap-4 py-4 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] leading-4 font-bold text-primary">
                            {index + 1}번 문장
                          </span>
                          <span
                            className={`mt-1.5 block text-[16px] leading-[1.55] break-keep transition-colors duration-200 ${on ? "font-bold text-[#191f28]" : "font-medium text-[#333d4b]"}`}
                          >
                            {sentence}
                          </span>
                        </span>
                        <PlayButton playing={on} progress={progress} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
            <button
              type="button"
              className="mt-6 w-full py-3 text-[12px] font-medium text-[#8b95a1] underline"
            >
              연습 기록 삭제
            </button>
          </div>
          <div className="app-tab-panel shrink-0 px-5 pb-4">
            <button
              type="button"
              onClick={() =>
                playback?.all
                  ? setPlayback(null)
                  : setPlayback({ index: 0, elapsed: 0, all: true })
              }
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-bold text-white"
            >
              {playback?.all ? (
                <Pause
                  size={18}
                  fill="currentColor"
                  strokeWidth={0}
                  aria-hidden="true"
                />
              ) : (
                <Play
                  size={18}
                  fill="currentColor"
                  strokeWidth={0}
                  aria-hidden="true"
                />
              )}
              {playback?.all ? "멈추기" : "전체 이어 듣기"}
            </button>
          </div>
        </>
      ) : (
        <div className="app-tab-panel min-h-0 flex-1 overflow-y-auto pb-5">
          <SentenceResultTabs
            active={reportActive}
            onSelect={setReportActive}
            tabs={SENTENCES.map((text, index) => ({
              key: text,
              text,
              state: "ready",
              score: ALL[index].overallScore,
              details: ALL[index].scoreDetails,
            }))}
            renderPanel={(shown) => (
              <AnalysisView
                key={shown}
                analysis={ALL[shown]}
                segments={[]}
                content={{
                  id: `history-preview-${shown}`,
                  contentType: "NEWS",
                  title: "미리보기",
                  scriptText: SENTENCES[shown],
                  referenceAudioAvailable: false,
                }}
                recordingId={shown + 1}
                reportParameter={`historyReport${shown}`}
                courseMode={false}
              />
            )}
          />
        </div>
      )}
    </main>
  );
}

const DURATIONS = [4.2, 5.6, 3.8, 4.9];

type Playback = { index: number; elapsed: number; all: boolean };

/** Advances the simulated playback; "play all" rolls on to the next take. */
function usePlaybackClock(
  playback: Playback | null,
  setPlayback: (next: Playback | null) => void,
) {
  const key = playback ? `${playback.index}-${playback.all}` : null;
  useEffect(() => {
    if (!playback) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const total = DURATIONS[playback.index];
      if (elapsed < total) {
        setPlayback({ ...playback, elapsed });
        frame = requestAnimationFrame(tick);
      } else if (playback.all && playback.index < DURATIONS.length - 1) {
        setPlayback({ index: playback.index + 1, elapsed: 0, all: true });
      } else {
        setPlayback(null);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Restart only when the take changes, not on every elapsed tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Round play control; while playing, a ring fills with the take's progress. */
function PlayButton({
  playing,
  progress,
}: {
  playing: boolean;
  progress: number;
}) {
  const r = 19;
  const length = 2 * Math.PI * r;
  return (
    <span
      aria-hidden="true"
      className={`relative flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${playing ? "bg-primary text-white" : "bg-[#f1edff] text-primary"}`}
    >
      {playing ? (
        <svg
          viewBox="0 0 44 44"
          className="absolute inset-0 size-full -rotate-90"
        >
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke="rgb(255 255 255 / 0.3)"
            strokeWidth="2"
          />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - progress)}
          />
        </svg>
      ) : null}
      {playing ? (
        <Pause size={16} fill="currentColor" strokeWidth={0} />
      ) : (
        <Play
          size={16}
          fill="currentColor"
          strokeWidth={0}
          className="translate-x-px"
        />
      )}
    </span>
  );
}
