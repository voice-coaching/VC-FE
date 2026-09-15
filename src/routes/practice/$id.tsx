"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PracticeDetail } from "@/components/practice-detail";
import { PracticeSession } from "@/components/practice-session";
import { TopBar } from "@/components/top-bar";
import { api, type PracticeContent } from "@/lib/api";
import { safeInternalPath } from "@/lib/navigation";

export default function Practice({ contentId }: { contentId: string }) {
  const searchParams = useSearchParams();
  const [started, setStarted] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("연습하기");
  const [content, setContent] = useState<PracticeContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = safeInternalPath(requestedReturnTo, "/home");

  useEffect(() => {
    let active = true;
    setContent(null);
    setError(null);
    setStarted(false);
    api.content
      .get(contentId)
      .then((value) => active && setContent(value))
      .catch(
        (reason) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "콘텐츠를 불러오지 못했습니다.",
          ),
      );
    return () => {
      active = false;
    };
  }, [contentId]);

  return (
    <AppShell nav={false}>
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
    </AppShell>
  );
}
