"use client";

import { useRef, useState } from "react";
import {
  coachingSeekTime,
  visualMeasurementLabel,
  type AnalysisCoaching,
} from "@/lib/coaching";

const roles = { onset: "초성", nucleus: "모음", coda: "받침" };

export function CoachingView({
  coaching,
  recordingUrl,
}: {
  coaching: AnalysisCoaching;
  recordingUrl?: string;
}) {
  const player = useRef<HTMLAudioElement>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const title =
    coaching.status === "READY"
      ? "이번에 연습할 발음"
      : coaching.status === "LIMITED_EVIDENCE"
        ? "판단을 보류한 부분이 있어요"
        : "현재 확인된 교정 항목이 없어요";

  async function listenAt(seconds: number) {
    const audio = player.current;
    if (
      !audio ||
      audio.readyState < 1 ||
      (Number.isFinite(audio.duration) && seconds >= audio.duration)
    ) {
      setPlaybackError("녹음을 불러온 뒤 다시 눌러 주세요.");
      return;
    }
    try {
      audio.currentTime = seconds;
      await audio.play();
      setPlaybackError(null);
    } catch {
      setPlaybackError(
        "녹음을 재생하지 못했어요. 재생 버튼으로 다시 시도해 주세요.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <section className="design-card space-y-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm leading-6">{coaching.summary}</p>
        <p className="text-xs text-muted-foreground">
          {coaching.score.validity === "INSUFFICIENT_EVIDENCE"
            ? "평가 근거가 부족한 항목이 있어 점수를 보류했어요. 0점을 뜻하지 않아요."
            : "점수의 타당성 검증이 완료되기 전에는 숫자 대신 관측과 연습을 제공해요."}
        </p>
        {coaching.generation.source === "TEMPLATE" &&
          coaching.items.length > 0 && (
            <p className="text-xs text-muted-foreground">
              이번에는 분석 근거에 연결된 기본 연습 안내를 제공해요.
            </p>
          )}
        {recordingUrl && (
          <audio
            ref={player}
            controls
            preload="metadata"
            src={recordingUrl}
            aria-label="내 녹음 다시 듣기"
            className="w-full"
          />
        )}
        {playbackError && (
          <p role="status" className="text-sm">
            {playbackError}
          </p>
        )}
      </section>

      {coaching.strengths.length > 0 && (
        <section className="design-card">
          <h2 className="font-bold">유지하면 좋은 점</h2>
          <ul className="mt-2 space-y-2">
            {coaching.strengths.map((value, i) => (
              <li key={i}>{value}</li>
            ))}
          </ul>
        </section>
      )}

      {coaching.items.map((item, index) => {
        const seconds = coachingSeekTime(item);
        return (
          <section key={item.candidateId} className="design-card space-y-3">
            <h2 className="font-bold">
              {index + 1}.{" "}
              {item.location.word ? `‘${item.location.word}’의 ` : ""}‘
              {item.expectedPhone}’ 연습
            </h2>
            <p className="text-sm leading-6">{item.action}</p>
            <div className="rounded-xl bg-muted p-3 text-sm leading-6">
              <p className="font-semibold">짧게 연습하기</p>
              <p>{item.practice}</p>
              <p className="mt-2 font-semibold">스스로 확인하기</p>
              <p>{item.selfCheck}</p>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer py-2 font-medium">
                어떤 근거인가요?
              </summary>
              <p className="leading-6">{item.observation}</p>
              <p className="mt-2 leading-6">{item.explanation}</p>
              {item.location.writtenRole && (
                <p className="mt-2 text-xs text-muted-foreground">
                  글자 위치: {roles[item.location.writtenRole]}. 실제 소리의
                  경계는 연음 등에 따라 달라질 수 있어요.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                모델의 확인 후보이며 실제 대치나 조음 원인이 확정됐다는 뜻은
                아니에요.
              </p>
            </details>
            {recordingUrl && seconds !== null && (
              <button
                type="button"
                className="text-sm font-semibold text-primary"
                onClick={() => void listenAt(seconds)}
              >
                대략 {seconds.toFixed(2)}초부터 다시 듣기
              </button>
            )}
          </section>
        );
      })}

      {coaching.visual.observations.some(
        (observation) => observation.measurements.length > 0,
      ) && (
        <details className="design-card text-sm">
          <summary className="cursor-pointer font-semibold">
            입술 관측 자세히 보기
          </summary>
          <p className="mt-2 text-muted-foreground">
            같은 시도의 구간별 관측이에요. 올바른 입 모양이나 개인별 교정
            기준으로 검증된 점수는 아니에요.
          </p>
          {coaching.visual.observations
            .filter((observation) => observation.measurements.length > 0)
            .map((observation) => (
              <div key={observation.expectedIndex} className="mt-3">
                <ul className="mt-2 space-y-1">
                  {observation.measurements.map((measurement) => (
                    <li key={measurement.cueId}>
                      {(measurement.startMs / 1000).toFixed(2)}~
                      {(measurement.endMs / 1000).toFixed(2)}초 ·{" "}
                      {visualMeasurementLabel(measurement.cueId)}:{" "}
                      {measurement.value.toFixed(4)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </details>
      )}
      {coaching.limitations.length > 0 && (
        <details className="design-card text-sm">
          <summary className="cursor-pointer font-semibold">
            이번 분석에서 확인하지 못한 부분
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-4">
            {coaching.limitations.map((value, i) => (
              <li key={i}>{value}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
