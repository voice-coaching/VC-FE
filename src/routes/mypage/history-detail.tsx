"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  type AnalysisResult,
  type AnalysisSegment,
  type PracticeContent,
  type TrainingHistoryDetail,
} from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import {
  readUserClientCache,
  removeUserClientCache,
  removeUserClientCacheGroup,
  writeUserClientCache,
} from "@/lib/client-cache";
import { splitSentences } from "@/lib/sentences";

type DetailBundle = {
  detail: TrainingHistoryDetail;
  content: PracticeContent;
  analysis: AnalysisResult;
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = readUserClientCache<DetailBundle>(userId, cacheResource);
    setBundle(cached);
    setError(null);
    void (async () => {
      try {
        const detail = await api.myPage.getTrainingSession(sessionId);
        const [content, analysis, segmentPage] = await Promise.all([
          api.content.get(detail.content.id),
          api.analyses.get(detail.analysis.id),
          api.analyses.getSegments(detail.analysis.id, { page: 0, size: 100 }),
        ]);
        if (active) {
          const value = {
            detail,
            content,
            analysis,
            segments: segmentPage.items,
          };
          setBundle(value);
          writeUserClientCache(userId, cacheResource, value);
        }
      } catch (reason) {
        if (active && !cached)
          setError(
            reason instanceof Error
              ? reason.message
              : "학습 기록을 불러오지 못했습니다.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [cacheResource, sessionId, userId]);

  async function deleteHistory() {
    setDeleting(true);
    setError(null);
    try {
      await api.myPage.deleteTrainingSession(sessionId);
      removeUserClientCache(userId, cacheResource);
      removeUserClientCacheGroup(userId, "mypage-history-");
      removeUserClientCacheGroup(userId, "home-");
      removeUserClientCacheGroup(userId, "streak-");
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
        <p
          role="alert"
          className="m-5 rounded-2xl bg-red-50 p-4 text-sm text-red-600"
        >
          {error}
        </p>
      )}
      {!bundle && !error && (
        <p className="py-12 text-center text-sm text-[#8b95a1]">
          기록을 불러오는 중…
        </p>
      )}

      {bundle && tab === "recording" && (
        <>
          <main className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
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
              type="button"
              disabled={deleting}
              onClick={() => setConfirmDelete(true)}
              className="mt-6 w-full py-3 text-[12px] font-medium text-[#8b95a1] underline disabled:opacity-50"
            >
              {deleting ? "삭제 중…" : "연습 기록 삭제"}
            </button>
          </main>
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
        <main className="min-h-0 flex-1 overflow-y-auto">
          <AnalysisView
            analysis={bundle.analysis}
            segments={bundle.segments}
            content={bundle.content}
            recordingId={bundle.detail.recording.id}
            courseMode={bundle.content.contentType === "CLASS_PRACTICE"}
          />
        </main>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="w-[calc(100%-40px)] max-w-[362px] rounded-[24px] border-0">
          <AlertDialogHeader>
            <AlertDialogTitle>이 연습 기록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제한 기록과 분석 결과는 복구할 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 grid grid-cols-2 gap-2 space-x-0">
            <AlertDialogCancel className="mt-0 min-h-12 rounded-full">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12 rounded-full bg-red-500 text-white"
              onClick={() => void deleteHistory()}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
