"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { scoreColor } from "@/lib/app-data";
import { api, type TrainingHistoryDetail } from "@/lib/api";

export default function LearningHistoryDetail({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<TrainingHistoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    api.myPage
      .getTrainingSession(sessionId)
      .then((value) => active && setDetail(value))
      .catch(
        (reason) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "학습 기록을 불러오지 못했습니다.",
          ),
      );
    return () => {
      active = false;
    };
  }, [sessionId]);

  async function playRecording() {
    if (!detail) return;
    try {
      const { playbackUrl } = await api.training.getRecordingPlaybackUrl(
        detail.recording.id,
      );
      await new Audio(playbackUrl).play();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "녹음 파일을 재생하지 못했습니다.",
      );
    }
  }

  async function deleteHistory() {
    if (!window.confirm("이 학습 기록을 삭제할까요?")) return;
    setDeleting(true);
    setError(null);
    try {
      await api.myPage.deleteTrainingSession(sessionId);
      router.replace("/mypage/history");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "학습 기록을 삭제하지 못했습니다.",
      );
      setDeleting(false);
    }
  }

  return (
    <AppShell nav={false}>
      <TopBar to="/mypage/history" title="학습 기록 상세" />
      <div className="space-y-4 px-5 pb-10">
        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {!detail && !error && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            기록을 불러오는 중…
          </p>
        )}
        {detail && (
          <>
            <section className="rounded-3xl bg-surface p-5">
              <p className="text-xs text-muted-foreground">
                {new Date(detail.session.completedAt).toLocaleString("ko-KR")}
              </p>
              <h1 className="mt-2 text-xl font-bold">{detail.content.title}</h1>
              <p className="mt-4 text-sm leading-relaxed">
                {detail.content.scriptText}
              </p>
              <div className="mt-5 flex items-end justify-between">
                <button
                  type="button"
                  onClick={() => void playRecording()}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                >
                  내 녹음 듣기
                </button>
                <strong
                  className={`text-4xl ${scoreColor(detail.analysis.overallScore)}`}
                >
                  {Math.round(detail.analysis.overallScore)}
                </strong>
              </div>
            </section>

            <section className="rounded-3xl border border-border p-5">
              <h2 className="text-sm font-semibold">분석 결과</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {detail.analysis.transcript}
              </p>
              <div className="mt-4 space-y-2">
                {detail.segments.map((segment) => (
                  <div
                    key={segment.sequenceNo}
                    className="rounded-2xl bg-surface px-4 py-3 text-xs"
                  >
                    <span className="font-semibold">
                      {segment.expectedText}
                    </span>
                    {segment.expectedText !== segment.recognizedText && (
                      <span className="ml-2 text-destructive">
                        → {segment.recognizedText}
                      </span>
                    )}
                    <span className="float-right text-muted-foreground">
                      {segment.resultStatus}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <button
              type="button"
              disabled={deleting}
              onClick={() => void deleteHistory()}
              className="w-full py-3 text-xs font-semibold text-destructive underline disabled:opacity-50"
            >
              {deleting ? "삭제 중…" : "학습 기록 삭제"}
            </button>
          </>
        )}
      </div>
    </AppShell>
  );
}
