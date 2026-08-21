"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PracticeSession } from "@/components/practice-session";
import { TopBar } from "@/components/top-bar";
import { api, type PracticeContent } from "@/lib/api";
import { safeInternalPath } from "@/lib/navigation";

export default function Practice({ contentId }: { contentId: string }) {
  const searchParams = useSearchParams();
  const [content, setContent] = useState<PracticeContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = safeInternalPath(requestedReturnTo, "/home");

  useEffect(() => {
    let active = true;
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
      <TopBar to={returnTo} progress={40} />
      {error ? (
        <p
          role="alert"
          className="px-5 py-12 text-center text-sm text-destructive"
        >
          {error}
        </p>
      ) : content ? (
        <PracticeSession content={content} />
      ) : (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          콘텐츠를 불러오는 중…
        </p>
      )}
    </AppShell>
  );
}
