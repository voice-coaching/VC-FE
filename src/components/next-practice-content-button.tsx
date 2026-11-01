"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, type PracticeContent } from "@/lib/api";
import { getAuthSessionVersion } from "@/lib/api/client";
import { safeInternalPath } from "@/lib/navigation";
import { practiceDetailHref } from "@/lib/practice-entry";

/** Forward navigation belongs to the completed run, never the article preview. */
export function NextPracticeContentButton({
  content,
  recordingComplete,
  onNext,
}: {
  content: PracticeContent;
  recordingComplete: boolean;
  onNext: (href: string) => void;
}) {
  const params = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const owner = useRef({ active: false });
  useLayoutEffect(() => {
    const currentOwner = { active: true };
    owner.current = currentOwner;
    busy.current = false;
    setNavigating(false);
    setError(null);
    return () => {
      currentOwner.active = false;
    };
  }, [content.id, recordingComplete]);
  const news = content.contentType === "NEWS";

  async function next() {
    if (!recordingComplete || busy.current) return;
    busy.current = true;
    const currentOwner = owner.current;
    const authEpoch = getAuthSessionVersion();
    const isCurrent = () =>
      currentOwner.active && authEpoch === getAuthSessionVersion();
    setNavigating(true);
    setError(null);
    try {
      const following = news
        ? (await api.content.getAdjacent(content.id, { type: "NEWS" })).next
        : await api.content.getNext({
            type: content.contentType,
            category: content.category,
            difficulty: content.difficulty,
            excludeId: content.id,
          });
      if (!isCurrent()) return;
      if (!following || String(following.id) === String(content.id)) {
        setError(news ? "다음 기사가 없어요." : "다음 문제가 없어요.");
        return;
      }
      const fallback = news
        ? "/news"
        : content.contentType === "ANNOUNCER"
          ? "/announcer"
          : "/sentences";
      const returnTo = safeInternalPath(params.get("returnTo"), fallback);
      const href = practiceDetailHref(following.id, returnTo);
      // Start a fresh content visit; do not carry session/resume/report state forward.
      onNext(
        news
          ? `${href}&previousId=${encodeURIComponent(String(content.id))}`
          : href,
      );
    } catch (reason) {
      if (isCurrent())
        setError(
          reason instanceof Error
            ? reason.message
            : "다음 콘텐츠를 불러오지 못했어요. 다시 시도해 주세요.",
        );
    } finally {
      if (isCurrent()) {
        busy.current = false;
        setNavigating(false);
      }
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!recordingComplete || navigating}
        onClick={() => void next()}
        className="min-h-12 w-full rounded-full border border-primary px-4 text-sm font-bold text-primary disabled:opacity-40"
      >
        {navigating ? "불러오는 중…" : news ? "다음 기사" : "다음 문제"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
