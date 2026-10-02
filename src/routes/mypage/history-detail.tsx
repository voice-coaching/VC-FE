"use client";

import { SkeletonBlock } from "@/components/skeleton-block";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  canonicalApi,
  canonicalDatabaseId,
  type CanonicalOrLegacyAnalysis,
} from "@/lib/api/canonical";
import { getAuthSessionVersion, subscribeAuthSession } from "@/lib/api/client";
import { CanonicalAnalysisView } from "@/components/canonical-analysis-view";
import { AnalysisView } from "@/components/analysis-view";
import { AppShell } from "@/components/app-shell";
import { ReferencePlayer } from "@/components/reference-player";
import { TopBar } from "@/components/top-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  api,
  type AnalysisSegment,
  type PracticeContent,
  type TrainingHistoryDetail,
} from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import {
  removeUserClientCache,
  removeUserClientCacheGroup,
} from "@/lib/client-cache";
import { splitSentences } from "@/lib/sentences";
import { useHistoryPanel } from "@/hooks/use-history-panel";
import { previousNavigationPath } from "@/lib/navigation-history";
import { removeCachedHistorySession } from "@/lib/history-cache";

type DetailBundle = {
  detail: TrainingHistoryDetail;
  content: PracticeContent;
  result: CanonicalOrLegacyAnalysis;
  segments: AnalysisSegment[];
};

const contentLabels: Record<PracticeContent["contentType"], string> = {
  NEWS: "뉴스 읽기",
  SENTENCE: "문장 연습",
  ANNOUNCER: "아나운서 따라 읽기",
  CLASS_PRACTICE: "클래스",
};

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
  // Never restore unverified result payloads from persistent UI cache.
  const [bundle, setBundle] = useState<DetailBundle | null>(null);
  const readController = useRef<AbortController | null>(null);
  const [tab, setTab] = useState<"recording" | "report">("recording");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useHistoryPanel("confirm", [
    "delete",
  ] as const);
  const confirmDelete = confirmation === "delete";
  const setConfirmDelete = (open: boolean) =>
    setConfirmation(open ? "delete" : null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [deleted, setDeleted] = useState(false);
  const deleteBusy = useRef(false);
  const deletedRef = useRef(false);
  const leaving = useRef(false);
  const lifecycle = useRef(0);
  const deleteTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    lifecycle.current += 1;
    return () => {
      lifecycle.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!deleted || confirmDelete || leaving.current) return;
    leaving.current = true;
    // The confirmation entry has now closed. Only go back if the detail was
    // actually opened from our list; direct links replace the current page.
    if (previousNavigationPath(window.history.state) === "/mypage/history") {
      window.history.back();
    } else {
      router.replace("/mypage/history");
    }
  }, [deleted, confirmDelete, router]);

  useEffect(() => {
    const controller = new AbortController();
    readController.current = controller;
    const epoch = getAuthSessionVersion();
    const active = () =>
      !controller.signal.aborted &&
      !deletedRef.current &&
      !deleteBusy.current &&
      epoch === getAuthSessionVersion();
    setBundle(null);
    setError(null);
    // Discard an old cached detail, including any canonical projection.
    removeUserClientCache(userId, cacheResource);
    void (async () => {
      try {
        const detail = await api.myPage.getTrainingSession(sessionId);
        if (!active()) return;
        const result = await canonicalApi.getWithLegacyFallback(
          {
            analysisId: canonicalDatabaseId(detail.analysis.id),
            recordingId: canonicalDatabaseId(detail.recording.id),
          },
          controller.signal,
        );
        if (!active()) return;
        const content = await api.content.get(detail.content.id);
        if (!active()) return;
        if (String(content.id) !== String(detail.content.id))
          throw new Error("기록의 콘텐츠를 확인할 수 없습니다.");
        const segmentPage =
          result.kind === "legacy" && result.analysis.coaching == null
            ? await api.analyses.getSegments(detail.analysis.id, {
                page: 0,
                size: 100,
              })
            : { items: [] };
        if (active())
          setBundle({
            detail,
            content: { ...content, scriptText: detail.content.scriptText },
            result,
            segments: segmentPage.items,
          });
      } catch (reason) {
        if (active()) {
          setBundle(null);
          setError(
            reason instanceof Error
              ? reason.message
              : "학습 기록을 불러오지 못했습니다.",
          );
        }
      }
    })();
    return () => controller.abort();
  }, [cacheResource, sessionId, userId, retry]);

  async function deleteHistory() {
    if (deleteBusy.current || !bundle) return;
    deleteBusy.current = true;
    const requestLifecycle = lifecycle.current;
    setDeleting(true);
    setDeleteError(null);
    readController.current?.abort();
    setBundle(null);
    removeUserClientCache(userId, cacheResource);
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
      setError(
        "삭제 상태를 확인하지 못했습니다. 현재 기록을 다시 조회해 주세요.",
      );
    }
  }

  const sentences = bundle
    ? splitSentences(bundle.content.scriptText)
    : ([] as string[]);

  return (
    <AppShell
      nav={false}
      viewportLocked
      className="flex flex-col !bg-[#f2f4f6]"
    >
      <div className="shrink-0 bg-white">
        <TopBar
          to="/mypage/history"
          title={
            bundle ? contentLabels[bundle.content.contentType] : "연습 기록"
          }
        />
        <div className="flex px-5">
          <button
            type="button"
            onClick={() => setTab("recording")}
            className={`h-[52px] flex-1 border-b text-[15px] leading-[22px] ${tab === "recording" ? "border-b-2 border-[#191f28] font-bold text-[#191f28]" : "border-[#e5e8eb] font-medium text-[#8b95a1]"}`}
          >
            녹음
          </button>
          <button
            type="button"
            onClick={() => setTab("report")}
            className={`h-[52px] flex-1 border-b text-[15px] leading-[22px] ${tab === "report" ? "border-b-2 border-[#191f28] font-bold text-[#191f28]" : "border-[#e5e8eb] font-medium text-[#8b95a1]"}`}
          >
            AI 리포트
          </button>
        </div>
      </div>

      {error && (
        <div className="m-5 min-h-0 overflow-y-auto rounded-2xl bg-red-50 p-4 text-sm text-red-600 [overflow-wrap:anywhere]">
          <p role="alert">{error}</p>
          <button
            type="button"
            className="mt-2 min-h-11 font-semibold text-primary"
            onClick={() => {
              setError(null);
              setRetry((value) => value + 1);
            }}
          >
            다시 시도
          </button>
        </div>
      )}
      {!bundle && !error && !deleting && !deleted && <HistoryDetailSkeleton />}

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
          {bundle.result.kind === "canonical" ? (
            <div className="space-y-4 p-5">
              <CanonicalAnalysisView
                data={bundle.result.analysis}
                currentIdentity={bundle.result.analysis}
              />
              <button
                type="button"
                className="design-action"
                onClick={() =>
                  router.push(
                    `/practice/${encodeURIComponent(String(bundle.content.id))}?sessionId=${encodeURIComponent(sessionId)}&resumeType=ANALYSIS_RESULT`,
                  )
                }
              >
                현재 분석 확인·이어가기
              </button>
            </div>
          ) : (
            <AnalysisView
              key={String(bundle.result.analysis.id)}
              analysis={bundle.result.analysis}
              segments={bundle.segments}
              content={bundle.content}
              recordingId={bundle.detail.recording.id}
              courseMode={bundle.content.contentType === "CLASS_PRACTICE"}
            />
          )}
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
