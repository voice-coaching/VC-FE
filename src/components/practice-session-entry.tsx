"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { api, type PracticeContent } from "@/lib/api";
import {
  ApiError,
  getAuthSessionVersion,
  subscribeAuthSession,
} from "@/lib/api/client";
import {
  canonicalApi,
  canonicalDatabaseId,
  isLegacyAnalysis,
} from "@/lib/api/canonical";
import { CanonicalPracticeSession } from "./canonical-practice-session";

type Props = {
  content: PracticeContent;
  localOnly?: boolean;
  onTitleChange?: (title: string) => void;
  children: ReactNode;
};

/** Re-key result memory across user/content/route changes; never cache canonical evidence. */
export function PracticeSessionEntry(props: Props) {
  const epoch = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionVersion,
    () => 0,
  );
  const search = useSearchParams();
  // Report/dialog navigation does not change the analysis attempt. Remounting
  // here would discard feedback and could invoke the legacy cancel cleanup.
  const attemptSearch = new URLSearchParams(search.toString());
  attemptSearch.delete("report");
  attemptSearch.delete("confirm");
  return (
    <Entry
      key={JSON.stringify([epoch, props.content.id, attemptSearch.toString()])}
      {...props}
    />
  );
}

function Entry({ content, localOnly, onTitleChange, children }: Props) {
  const search = useSearchParams();
  const sessionId = localOnly ? null : search.get("sessionId");
  const canonicalRequested = search.get("analysisMode") === "canonical";
  const resuming = !!sessionId;
  const eligible =
    !localOnly &&
    !search.get("courseId") &&
    !search.get("courseStepId") &&
    !search.get("titleExamId") &&
    content.contentType !== "CLASS_PRACTICE" &&
    ["PRONUNCIATION", "BOTH"].includes(content.learningFocus);
  const [mode, setMode] = useState<
    "choose" | "loading" | "legacy" | "canonical" | "error"
  >(resuming ? "loading" : eligible && !sessionId ? "choose" : "legacy");
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!resuming || !sessionId) return;
    const controller = new AbortController();
    const epoch = getAuthSessionVersion();
    const active = () =>
      !controller.signal.aborted && epoch === getAuthSessionVersion();
    setMode("loading");
    setError(null);
    void (async () => {
      try {
        const current = await api.training.get(sessionId);
        if (!active()) return;
        if (
          String(current.content?.id ?? current.contentId) !==
          String(content.id)
        )
          throw new Error("학습 콘텐츠가 일치하지 않습니다.");
        if (current.status === "CANCELED")
          throw new Error("취소된 학습 세션입니다.");
        const state = await canonicalApi
          .status(sessionId, controller.signal)
          .catch((failure: unknown) => {
            // This is a session with no analysis, not a canonical-view fallback.
            if (
              failure instanceof ApiError &&
              failure.status === 404 &&
              failure.code === "ANALYSIS_NOT_FOUND" &&
              ["RECORDING", "UPLOADING"].includes(current.status)
            )
              return null;
            throw failure;
          });
        if (!active()) return;
        if (!state) {
          setMode(
            canonicalRequested &&
              eligible &&
              current.courseStepId == null &&
              current.learningFocus === "PRONUNCIATION"
              ? "canonical"
              : "legacy",
          );
          return;
        }
        try {
          await canonicalApi.get(
            { analysisId: canonicalDatabaseId(state.analysisId) },
            controller.signal,
          );
          if (active()) setMode("canonical");
        } catch (failure) {
          if (!isLegacyAnalysis(failure)) throw failure;
          if (active()) setMode("legacy");
        }
      } catch (failure) {
        if (active()) {
          setMode("error");
          setError(
            failure instanceof Error
              ? failure.message
              : "현재 분석을 확인하지 못했습니다.",
          );
        }
      }
    })();
    return () => controller.abort();
  }, [content.id, resuming, sessionId, refresh, canonicalRequested, eligible]);

  if (mode === "loading")
    return (
      <p role="status" className="p-5">
        현재 분석 시도를 확인하고 있습니다…
      </p>
    );
  if (mode === "error")
    return (
      <div className="space-y-4 p-5">
        <p role="alert">{error}</p>
        <button type="button" onClick={() => setRefresh((value) => value + 1)}>
          다시 조회
        </button>
      </div>
    );
  // Existing canonical results are readable regardless of the new-request scope.
  if (mode === "canonical")
    return (
      <CanonicalPracticeSession
        content={content}
        initialSessionId={sessionId ?? undefined}
        onTitleChange={onTitleChange}
      />
    );
  if (mode === "choose")
    return (
      <section className="mx-5 mb-4 space-y-4 rounded-xl border p-4 text-sm">
        <h2 className="text-lg font-bold">분석 방식 선택</h2>
        <p>
          기존 분석은 그대로 이용할 수 있습니다. 새 근거 기반 분석은 점수 없이
          입력 판정·MFA 위치·최대 3개 연습을 제공합니다.
        </p>
        <button
          type="button"
          className="design-action"
          onClick={() => setMode("legacy")}
        >
          기존 분석으로 연습
        </button>
        <button
          type="button"
          className="mt-3 font-semibold text-primary"
          onClick={() => setMode("canonical")}
        >
          새 근거 기반 분석(v4) 선택
        </button>
      </section>
    );
  return children;
}
