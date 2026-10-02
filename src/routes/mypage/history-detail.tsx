"use client";

import { SkeletonBlock } from "@/components/skeleton-block";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/app-shell";
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
  const userId = getAuthenticatedUserId();
  const cacheResource = cacheResources.historyDetail(sessionId);
  const [initialBundle] = useState(() =>
    readUserClientCache<DetailBundle>(userId, cacheResource),
  );
  const [bundle, setBundle] = useState<DetailBundle | null>(initialBundle);
  const [tab, setTab] = useState<"recording" | "report">("recording");
  const [error, setError] = useState<string | null>(null);
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
    if (deleteBusy.current || !bundle) return;
    deleteBusy.current = true;
    const requestLifecycle = lifecycle.current;
    setDeleting(true);
    setError(null);
    setResult(null);
    setDetail(null);
    setPlaybackUrl(undefined);
    try {
      await api.myPage.deleteTrainingSession(sessionId);
      deletedRef.current = true;
      removeUserClientCache(userId, cacheResource);
      removeCachedHistorySession(userId, sessionId);
      removeUserClientCacheGroup(userId, "home-");
      removeUserClientCacheGroup(userId, "streak-");
      if (requestLifecycle !== lifecycle.current) return;
      setDeleted(true);
      setConfirmDelete(false);
    } catch (reason) {
      if (requestLifecycle !== lifecycle.current) return;
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : "학습 기록을 삭제하지 못했습니다.",
      );
      deleteBusy.current = false;
      setDeleting(false);
    }
  }

  const sentences = bundle
    ? splitSentences(bundle.content.scriptText)
    : ([] as string[]);

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

      {bundle && tab === "recording" && (
        <>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pt-4 pb-6 [overflow-wrap:anywhere]">
            <section className="space-y-3.5 rounded-[20px] bg-white p-[18px] text-[16px] leading-[1.6]">
              {sentences.map((sentence, index) => (
                <p
                  key={`${index}-${sentence}`}
                  className={
                    index === 0
                      ? "font-bold text-[#191f28]"
                      : "font-medium text-[#b0b8c1]"
                  }
                >
                  {sentence}
                </p>
              ))}
            </section>
            <button
              ref={deleteTrigger}
              type="button"
              disabled={deleting}
              onClick={() => {
                setDeleteError(null);
                setConfirmDelete(true);
              }}
              className="mt-6 w-full py-3 text-[12px] font-medium text-[#8b95a1] underline disabled:opacity-50"
            >
              {deleting ? "삭제 중…" : "연습 기록 삭제"}
            </button>
          </div>
          <div className="shrink-0 px-5 pb-4">
            <ReferencePlayer
              recordingId={bundle.detail.recording.id}
              title="내 녹음 듣기"
              durationSeconds={bundle.detail.recording.durationMs / 1_000}
              variant="recording"
            />
          </div>
        </>
      )}

      {bundle && tab === "report" && (
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <AnalysisView
            analysis={bundle.analysis}
            segments={bundle.segments}
            content={bundle.content}
            recordingId={bundle.detail.recording.id}
            courseMode={bundle.content.contentType === "CLASS_PRACTICE"}
          />
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent
          className="max-h-[calc(100dvh-40px)] w-[calc(100%-40px)] max-w-[362px] overflow-y-auto rounded-[24px] border-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!deleted) deleteTrigger.current?.focus({ preventScroll: true });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>이 연습 기록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제한 기록과 분석 결과는 복구할 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p
              role="alert"
              className="text-sm text-destructive [overflow-wrap:anywhere]"
            >
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter className="mt-2 grid grid-cols-2 gap-2 space-x-0">
            <AlertDialogCancel
              disabled={deleting}
              className="mt-0 min-h-12 rounded-full"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12 rounded-full bg-red-500 text-white"
              disabled={deleting || !bundle}
              onClick={(event) => {
                event.preventDefault();
                void deleteHistory();
              }}
            >
              {deleting ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function HistoryDetailSkeleton() {
  return (
    <div role="status" aria-busy="true" className="px-5 pt-4">
      <span className="sr-only">기록을 불러오는 중</span>
      <div className="space-y-4 rounded-[20px] bg-white p-[18px]">
        <SkeletonBlock className="h-4 w-11/12" />
        <SkeletonBlock className="h-4 w-4/5" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-3/5" />
      </div>
    </div>
  );
}
