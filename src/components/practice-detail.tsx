"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReferencePlayer } from "@/components/reference-player";
import {
  api,
  type AdjacentPracticeContent,
  type PracticeContent,
} from "@/lib/api";
import { categoryLabel } from "@/lib/content-labels";
import { splitSentences } from "@/lib/sentences";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import { readUserClientCache, writeUserClientCache } from "@/lib/client-cache";

export function PracticeDetail({
  content,
  onStart,
}: {
  content: PracticeContent;
  onStart: () => void;
}) {
  const [script, setScript] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const previousId = search.get("previousId");
  const userId = getAuthenticatedUserId();
  const adjacentResource = cacheResources.adjacentContent(
    content.id,
    content.contentType,
  );
  const [initialAdjacent] = useState(() =>
    readUserClientCache<AdjacentPracticeContent>(userId, adjacentResource),
  );
  const [adjacent, setAdjacent] = useState<AdjacentPracticeContent | null>(
    initialAdjacent,
  );

  useEffect(() => {
    if (content.contentType !== "NEWS") return;
    let active = true;
    const cached = readUserClientCache<AdjacentPracticeContent>(
      userId,
      adjacentResource,
    );
    setAdjacent(cached);
    setNavigationError(null);
    api.content
      .getAdjacent(content.id, {
        type: content.contentType,
      })
      .then((result) => {
        if (!active) return;
        setAdjacent(result);
        writeUserClientCache(userId, adjacentResource, result);
      })
      .catch((reason: unknown) => {
        if (!active || cached) return;
        setNavigationError(
          reason instanceof Error
            ? reason.message
            : "이전·다음 기사를 불러오지 못했습니다.",
        );
      });
    return () => {
      active = false;
    };
  }, [adjacentResource, content.contentType, content.id, userId]);

  function nextArticle() {
    if (!adjacent?.next) return;
    setNavigating(true);
    setNavigationError(null);
    router.push(
      `/practice/${encodeURIComponent(String(adjacent.next.id))}?returnTo=%2Fnews&previousId=${encodeURIComponent(String(content.id))}`,
    );
  }
  const announcer = content.contentType === "ANNOUNCER";
  const news = content.contentType === "NEWS";
  const sentences = splitSentences(content.scriptText);
  const difficulty = {
    BEGINNER: "초급",
    INTERMEDIATE: "중급",
    ADVANCED: "고급",
  }[content.difficulty];
  return (
    <div className="flex min-h-[calc(100dvh-80px)] flex-col">
      <div className="space-y-4 px-5 pb-6">
        {announcer ? (
          <>
            <div>
              <p className="mb-3 text-xs text-muted-foreground">
                <span className="mr-2 rounded-full bg-[#edf2ff] px-3 py-1 text-primary">
                  {difficulty}
                </span>
                {sentences.length}문장　|　
                {Math.floor(content.estimatedSeconds / 60)
                  .toString()
                  .padStart(2, "0")}
                :
                {Math.round(content.estimatedSeconds % 60)
                  .toString()
                  .padStart(2, "0")}
              </p>
              <h2 className="text-2xl font-bold">{content.title}</h2>
            </div>
            {content.referenceAudioAvailable && (
              <ReferencePlayer contentId={content.id} title="예시 음성" />
            )}
            <h3 className="text-sm font-bold">스크립트</h3>
            <ol className="design-card space-y-5">
              {sentences.map((sentence, index) => (
                <li key={index} className="flex gap-3 text-base leading-7">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#f2f4f6] text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  {sentence.trim()}
                </li>
              ))}
            </ol>
          </>
        ) : script ? (
          <>
            <h2 className="text-2xl font-bold">이 문장들을 연습해요</h2>
            {content.referenceAudioAvailable && (
              <ReferencePlayer contentId={content.id} title="먼저 들어보기" />
            )}
            <h3 className="pt-3 text-base font-semibold">연습 문장</h3>
            <ol className="design-card space-y-5">
              {sentences.map((sentence, index) => (
                <li
                  key={index}
                  className="flex gap-3 text-base leading-relaxed"
                >
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  {sentence.trim()}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <section className={news ? "" : "design-card !py-7 text-center"}>
              <div
                className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"
                style={{ justifyContent: news ? "flex-start" : "center" }}
              >
                <span className="rounded bg-muted px-2 py-1">{difficulty}</span>
                <span>{categoryLabel(content.category)}</span>
              </div>
              <h2 className="text-[23px] leading-[1.5] font-bold tracking-tight">
                {news ? content.title : content.scriptText}
              </h2>
            </section>
            {news ? (
              <>
                <article className="design-card whitespace-pre-line text-[15px] leading-7">
                  {content.scriptText}
                </article>
                <div className="flex justify-between rounded-xl bg-primary/5 p-4 text-xs">
                  <span>이 기사에서 {sentences.length}문장을 연습해요</span>
                  <span className="text-primary">
                    약 {Math.max(1, Math.ceil(content.estimatedSeconds / 60))}분
                  </span>
                </div>
              </>
            ) : (
              <>
                <section className="rounded-2xl bg-[#edf2ff] p-4">
                  <h3 className="mb-2 text-xs font-medium text-primary">
                    이 문장으로 무엇을 연습하나요
                  </h3>
                  <p className="text-sm leading-6">{content.description}</p>
                  {content.targetPronunciations.length > 0 && (
                    <p className="mt-2 text-xs text-primary">
                      {content.targetPronunciations.join(" · ")}
                    </p>
                  )}
                </section>
                {content.referenceAudioAvailable && (
                  <ReferencePlayer contentId={content.id} />
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className="design-dock">
        {news && !script && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={(!adjacent?.previous && !previousId) || navigating}
                onClick={() =>
                  router.push(
                    `/practice/${encodeURIComponent(String(adjacent?.previous?.id ?? previousId))}?returnTo=%2Fnews`,
                  )
                }
                className="flex items-center justify-center gap-1 rounded-xl border border-border bg-white py-3 text-xs disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
                이전 기사
              </button>
              <button
                type="button"
                disabled={!adjacent?.next || navigating}
                onClick={nextArticle}
                className="flex items-center justify-center gap-1 rounded-xl border border-border bg-white py-3 text-xs disabled:opacity-40"
              >
                {navigating ? "불러오는 중…" : "다음 기사"}
                <ChevronRight className="size-4" />
              </button>
            </div>
            {navigationError && (
              <p role="alert" className="mb-3 text-xs text-destructive">
                {navigationError}
              </p>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => (news && !script ? setScript(true) : onStart())}
          className="design-action"
        >
          {announcer
            ? "따라 읽기 시작"
            : script
              ? "녹음 시작하기"
              : "연습 시작하기"}
        </button>
      </div>
    </div>
  );
}
