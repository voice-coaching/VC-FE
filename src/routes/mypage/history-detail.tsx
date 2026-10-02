"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { ReferencePlayer } from "@/components/reference-player";
import { api, type TrainingHistoryDetail } from "@/lib/api";
import {
  canonicalApi,
  canonicalDatabaseId,
  type CanonicalOrLegacyAnalysis,
} from "@/lib/api/canonical";
import { getAuthSessionVersion, subscribeAuthSession } from "@/lib/api/client";
import { CanonicalAnalysisView } from "@/components/canonical-analysis-view";
import { CoachingView } from "@/components/coaching-view";
import { supportedCoaching } from "@/lib/coaching";

export default function LearningHistoryDetail({
  sessionId,
}: {
  sessionId: string;
}) {
  const epoch = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionVersion,
    () => 0,
  );
  return (
    <HistoryDetail
      key={JSON.stringify([epoch, sessionId])}
      sessionId={sessionId}
    />
  );
}

function HistoryDetail({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<TrainingHistoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<CanonicalOrLegacyAnalysis | null>(null);
  const [refresh, setRefresh] = useState(0);
  const coaching =
    result?.kind === "legacy"
      ? supportedCoaching(result.analysis.coaching)
      : null;

  useEffect(() => {
    const controller = new AbortController();
    const epoch = getAuthSessionVersion();
    const active = () =>
      !controller.signal.aborted && epoch === getAuthSessionVersion();
    setDetail(null);
    setResult(null);
    setPlaybackUrl(undefined);
    setError(null);
    void (async () => {
      try {
        const value = await api.myPage.getTrainingSession(sessionId);
        if (!active()) return;
        const current = await canonicalApi.getWithLegacyFallback(
          {
            analysisId: canonicalDatabaseId(value.analysis.id),
            recordingId: canonicalDatabaseId(value.recording.id),
          },
          controller.signal,
        );
        if (active()) {
          setDetail(value);
          setResult(current);
        }
      } catch (reason) {
        if (active())
          setError(
            reason instanceof Error
              ? reason.message
              : "학습 기록을 불러오지 못했습니다.",
          );
      }
    })();
    return () => {
      controller.abort();
    };
  }, [sessionId, refresh]);

  async function playRecording() {
    if (!detail) return;
    try {
      const { playbackUrl } = await api.training.getRecordingPlaybackUrl(
        detail.recording.id,
      );
      setPlaybackUrl(playbackUrl);
    } catch (reason) {
      setDetail(null);
      setResult(null);
      setPlaybackUrl(undefined);
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
    setResult(null);
    setDetail(null);
    setPlaybackUrl(undefined);
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
      <TopBar to="/mypage/history" title="연습 기록" />
      <div className="space-y-4 px-5 pb-10">
        {error && (
          <>
            <p
              role="alert"
              className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
            >
              현재 기록 다시 조회
            </button>
          </>
        )}
        {!detail && !error && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            기록을 불러오는 중…
          </p>
        )}
        {detail && (
          <>
            <section className="design-card">
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
                  className="rounded-full bg-primary/10 px-4 py-3 text-xs font-semibold text-primary"
                >
                  내 녹음 듣기
                </button>
                {result?.kind !== "canonical" && (
                  <strong className="text-4xl text-primary">
                    {detail.analysis.overallScore == null
                      ? "—"
                      : Math.round(detail.analysis.overallScore)}
                  </strong>
                )}
              </div>
            </section>

            {playbackUrl && (
              <ReferencePlayer source={playbackUrl} title="내 녹음" />
            )}
            {result?.kind === "canonical" ? (
              <>
                <CanonicalAnalysisView
                  data={result.analysis}
                  currentIdentity={result.analysis}
                />
                <button
                  type="button"
                  className="design-action"
                  onClick={() =>
                    router.push(
                      `/practice/${detail.content.id}?sessionId=${encodeURIComponent(sessionId)}&resumeType=ANALYSIS_RESULT`,
                    )
                  }
                >
                  현재 분석 확인·이어가기
                </button>
              </>
            ) : coaching ? (
              <CoachingView coaching={coaching} recordingUrl={playbackUrl} />
            ) : (
              <section className="design-card">
                <h2 className="text-sm font-semibold">분석 결과</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {detail.analysis.transcript ??
                    "음성 인식 결과가 제공되지 않았어요."}
                </p>
                <div className="mt-4 space-y-2">
                  {detail.segments.map((segment) => (
                    <div
                      key={segment.sequenceNo}
                      className="rounded-2xl bg-surface px-4 py-3 text-xs"
                    >
                      <span className="font-semibold">
                        {segment.expectedText ?? `구간 ${segment.sequenceNo}`}
                      </span>
                      {segment.recognizedText != null &&
                        segment.expectedText !== segment.recognizedText && (
                          <span className="ml-2 text-destructive">
                            → {segment.recognizedText}
                          </span>
                        )}
                      <span className="float-right text-muted-foreground">
                        {segment.resultStatus === "NORMAL"
                          ? "정확"
                          : "개선 필요"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

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
