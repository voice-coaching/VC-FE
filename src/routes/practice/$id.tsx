"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PracticeDetail } from "@/components/practice-detail";
import { PracticeSession } from "@/components/practice-session";
import { TopBar } from "@/components/top-bar";
import { api, type PracticeContent } from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import { readUserClientCache, writeUserClientCache } from "@/lib/client-cache";
import { safeInternalPath } from "@/lib/navigation";
import { loadPracticeContent } from "@/lib/practice-examples";

export default function Practice({ contentId }: { contentId: string }) {
  const searchParams = useSearchParams();
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = safeInternalPath(requestedReturnTo, "/home");
  const exampleId = searchParams.get("exampleId");
  const courseId = searchParams.get("courseId");
  const stepId = searchParams.get("courseStepId");
  const revision = searchParams.get("exampleRevision");
  const sessionId = searchParams.get("sessionId");
  const startImmediately = searchParams.get("start") === "1";
  const userId = getAuthenticatedUserId();
  const cacheResource = cacheResources.practiceSelection(
    contentId,
    exampleId,
    revision,
  );
  const [initialContent] = useState(() =>
    readUserClientCache<PracticeContent>(userId, cacheResource),
  );
  const [started, setStarted] = useState(
    Boolean(exampleId) || startImmediately,
  );
  const [sessionTitle, setSessionTitle] = useState("연습하기");
  const [content, setContent] = useState<PracticeContent | null>(
    initialContent,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const cached = readUserClientCache<PracticeContent>(userId, cacheResource);
    setContent(cached);
    setError(null);
    setStarted(Boolean(exampleId) || startImmediately);
    loadPracticeContent(api, contentId, {
      exampleId,
      courseId,
      stepId,
      revision,
      sessionId,
    })
      .then((value) => {
        if (!active) return;
        setContent(value);
        writeUserClientCache(userId, cacheResource, value);
      })
      .catch(
        (reason) =>
          active &&
          !cached &&
          setError(
            reason instanceof Error
              ? reason.message
              : "콘텐츠를 불러오지 못했습니다.",
          ),
      );
    return () => {
      active = false;
    };
  }, [
    contentId,
    exampleId,
    courseId,
    stepId,
    revision,
    sessionId,
    startImmediately,
    userId,
    cacheResource,
  ]);

  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#f2f4f6"
      className="flex min-h-0 flex-col bg-[#f2f4f6]"
    >
      <TopBar
        to={returnTo}
        title={
          started || searchParams.get("sessionId")
            ? sessionTitle
            : content?.contentType === "NEWS"
              ? "뉴스 읽기"
              : content?.contentType === "ANNOUNCER"
                ? "아나운서 따라 읽기"
                : "문장 연습"
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {error ? (
          <p
            role="alert"
            className="px-5 py-12 text-center text-sm text-destructive"
          >
            {error}
          </p>
        ) : content ? (
          started || searchParams.get("sessionId") ? (
            <PracticeSession
              key={String(content.id)}
              content={content}
              onTitleChange={setSessionTitle}
            />
          ) : (
            <PracticeDetail
              key={String(content.id)}
              content={content}
              onStart={() => setStarted(true)}
            />
          )
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            콘텐츠를 불러오는 중…
          </p>
        )}
      </div>
    </AppShell>
  );
}
