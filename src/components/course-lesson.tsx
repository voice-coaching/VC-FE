"use client";

import { useEffect, useState } from "react";
import styles from "./course-lesson.module.css";
import { ArrowLeft, CircleAlert, X } from "lucide-react";
import {
  api,
  type CourseStepDetail,
  type CourseSummary,
  type CourseStep,
  type PracticeContent,
  type PracticeExample,
  type PracticeExamples,
} from "@/lib/api";
import {
  TtsPracticeButton,
  useTtsPracticePlayer,
} from "@/components/tts-practice-player";
import { useHistoryPanel } from "@/hooks/use-history-panel";
import { useHistoryScroll } from "@/hooks/use-history-scroll";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import {
  readUserClientCache,
  updateUserClientCache,
  writeUserClientCache,
} from "@/lib/client-cache";

type CourseLessonCache = {
  detail?: CourseStepDetail;
  examples?: PracticeExamples;
};

export function CourseLesson({
  course,
  step,
  description,
  onClose,
  onPractice,
}: {
  course: CourseSummary;
  step: CourseStep;
  description?: string;
  onClose: () => void;
  onPractice: (example: PracticeExample, revision: number) => void;
}) {
  const userId = getAuthenticatedUserId();
  const cacheResource = cacheResources.courseLesson(course.id, step.id);
  const [initialCache] = useState(() =>
    readUserClientCache<CourseLessonCache>(userId, cacheResource),
  );
  const [panel, setPanel] = useHistoryPanel("examples", ["open"] as const);
  const example = panel === "open";
  const [visitedExamples, setVisitedExamples] = useState(false);
  useEffect(() => {
    if (example) setVisitedExamples(true);
  }, [example]);
  const selectionScope = `${userId}:${course.id}:${step.id}`;
  const player = useTtsPracticePlayer(example);
  const [content, setContent] = useState<PracticeContent | null>(null);
  const [stepDetail, setStepDetail] = useState<CourseStepDetail | null>(
    initialCache?.detail ?? null,
  );
  const [stepDetailError, setStepDetailError] = useState<string | null>(null);
  const [examples, setExamples] = useState<PracticeExamples | null>(
    initialCache?.examples ?? null,
  );
  const [exampleError, setExampleError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [detailReload, setDetailReload] = useState(0);
  const [contentReload, setContentReload] = useState(0);
  useEffect(() => {
    let active = true;
    const cached = readUserClientCache<CourseLessonCache>(
      userId,
      cacheResource,
    );
    setStepDetail(cached?.detail ?? null);
    setStepDetailError(null);
    api.courses
      .getStep(course.id, step.id)
      .then((value) => {
        if (!active) return;
        setStepDetail(value);
        updateUserClientCache<CourseLessonCache>(userId, cacheResource, {
          detail: value,
        });
      })
      .catch((reason: unknown) => {
        if (!active || cached?.detail) return;
        setStepDetailError(
          reason instanceof Error
            ? reason.message
            : "단계별 교육 내용을 불러오지 못했습니다.",
        );
      });
    return () => {
      active = false;
    };
  }, [cacheResource, course.id, step.id, userId, detailReload]);
  useEffect(() => {
    let active = true;
    const cached = readUserClientCache<CourseLessonCache>(
      userId,
      cacheResource,
    );
    setExamples(cached?.examples ?? null);
    setExampleError(null);
    api.examples
      .list(course.id, step.id)
      .then((value) => {
        if (!active) return;
        setExamples(value);
        updateUserClientCache<CourseLessonCache>(userId, cacheResource, {
          examples: value,
        });
      })
      .catch((reason) => {
        if (active && !cached?.examples)
          setExampleError(
            reason instanceof Error
              ? reason.message
              : "예문을 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, [cacheResource, course.id, reload, step.id, userId]);
  const [error, setError] = useState<string | null>(null);
  const detailPracticeContentId = stepDetail?.blocks.find(
    (block) => block.type === "PRACTICE_PROMPT",
  )?.practiceContentId;
  const practiceContentId = step.practiceContentId ?? detailPracticeContentId;
  useEffect(() => {
    let active = true;
    const resource =
      practiceContentId == null
        ? null
        : cacheResources.practiceContent(practiceContentId);
    const cached = resource
      ? readUserClientCache<PracticeContent>(userId, resource)
      : null;
    setContent(cached);
    setError(null);
    if (practiceContentId != null)
      api.content
        .get(practiceContentId)
        .then((value) => {
          if (!active) return;
          setContent(value);
          if (resource) writeUserClientCache(userId, resource, value);
        })
        .catch(
          (reason) =>
            active &&
            !cached &&
            setError(
              reason instanceof Error
                ? reason.message
                : "학습 자료를 불러오지 못했습니다.",
            ),
        );
    return () => {
      active = false;
    };
  }, [practiceContentId, userId, contentReload]);
  const scrollRef = useHistoryScroll(
    `${selectionScope}:${example ? "examples" : "lesson"}`,
    example
      ? examples !== null || exampleError !== null
      : stepDetail !== null || stepDetailError !== null,
  );
  return (
    <div
      ref={scrollRef}
      className="[--primary:#6346f6] bg-white flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-wrap:anywhere]"
    >
      <header className="flex h-12 shrink-0 items-center justify-between px-2 py-1">
        <button
          type="button"
          className="flex size-11 items-center justify-center"
          aria-label={example ? "학습 내용으로 돌아가기" : "학습 닫기"}
          onClick={() => (example ? setPanel(null) : onClose())}
        >
          {example ? (
            <ArrowLeft className="size-5" />
          ) : (
            <X className="size-5" />
          )}
        </button>
        <h1 className="text-[17px] font-bold">
          {example ? "예문 듣기" : "학습 안내"}
        </h1>
        <span className="size-11" aria-hidden="true" />
      </header>
      <ol
        aria-label="연습 순서"
        className="mx-5 mt-3 flex items-center gap-2 rounded-2xl bg-[#f7f8fa] p-3 text-xs"
      >
        {["학습 안내", "예문 듣기", "녹음 연습"].map((label, index) => (
          <li
            key={label}
            aria-current={index === (example ? 1 : 0) ? "step" : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 ${index === (example ? 1 : 0) ? "font-bold text-[#6346f6]" : "text-[#8b95a1]"}`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full ${index === (example ? 1 : 0) ? "bg-[#6346f6] text-white" : "bg-white"}`}
            >
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <div
        key={example ? "examples" : "lesson"}
        className={`space-y-5 px-5 py-6 ${example ? styles.enterForward : visitedExamples ? styles.enterBack : ""}`}
      >
        <div>
          <h2 className="text-[23px] font-bold">
            {example
              ? "예시를 듣고 따라 해 보세요"
              : (stepDetail?.title ?? step.title)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {example
              ? "문장 속 발음과 억양에 집중해서 들어 보세요"
              : (stepDetail?.subtitle ?? content?.description ?? description)}
          </p>
        </div>
        {error && (
          <div className="rounded-2xl bg-destructive/5 p-4 text-sm text-destructive">
            <p role="alert">{error}</p>
            <button
              type="button"
              className="mt-1 min-h-11 font-semibold text-primary"
              onClick={() => {
                setError(null);
                setContentReload((value) => value + 1);
              }}
            >
              학습 자료 다시 불러오기
            </button>
          </div>
        )}
        {stepDetailError && !example ? (
          <div className="rounded-2xl bg-destructive/5 p-4 text-sm text-destructive">
            <p role="alert">{stepDetailError}</p>
            <button
              type="button"
              className="mt-1 min-h-11 font-semibold text-primary"
              onClick={() => {
                setStepDetailError(null);
                setDetailReload((value) => value + 1);
              }}
            >
              교육 내용 다시 불러오기
            </button>
          </div>
        ) : null}
        {example ? (
          <>
            <div className="flex items-end justify-between gap-3 pt-1">
              <div>
                <h3 className="text-base font-semibold">
                  연습 문제 {examples?.items.length ?? 0}개
                </h3>
              </div>
            </div>
            {exampleError ? (
              <div role="alert">
                <p>{exampleError}</p>
                <button
                  type="button"
                  className="mt-1 min-h-11 font-semibold text-primary"
                  onClick={() => setReload((value) => value + 1)}
                >
                  다시 불러오기
                </button>
              </div>
            ) : !examples ? (
              <p role="status">예문을 불러오는 중…</p>
            ) : examples.items.length === 0 ? (
              <p>아직 등록된 예문이 없습니다.</p>
            ) : null}
            {player.audio}
            <ol className="space-y-2.5">
              {examples?.items.map((practiceExample, index) => (
                <li
                  key={practiceExample.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f1edff] text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[15px] leading-6">
                      {practiceExample.text}
                    </strong>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {practiceExample.hint}
                    </span>
                  </span>
                  <TtsPracticeButton
                    example={practiceExample}
                    index={index}
                    player={player}
                  />
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            {stepDetail ? (
              <div className="space-y-3">
                {stepDetail.blocks.map((block, index) => {
                  if (
                    block.type === "TEXT" &&
                    /^문장을 직접 녹음하며 연습합니다[.!。]?$/u.test(
                      block.body.trim(),
                    )
                  )
                    return null;
                  if (block.type === "TEXT")
                    return (
                      <section key={index} className="design-card">
                        {block.title ? (
                          <h3 className="mb-2 text-sm font-semibold">
                            {block.title}
                          </h3>
                        ) : null}
                        <p className="whitespace-pre-line text-sm leading-7">
                          {block.body}
                        </p>
                      </section>
                    );
                  if (block.type === "CHECKLIST")
                    return (
                      <section key={index} className="design-card">
                        <ul className="space-y-2 text-sm leading-6">
                          {block.items.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="text-primary">✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  if (block.type === "IMAGE")
                    return (
                      <figure
                        key={index}
                        className="overflow-hidden rounded-[20px] bg-[#f7f7f9]"
                      >
                        {/* The API returns versioned CDN URLs that cannot be known at build time. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={block.assetUrl}
                          alt={block.altText}
                          className="h-auto w-full object-cover"
                        />
                      </figure>
                    );
                  if (block.type === "AUDIO")
                    return (
                      <CourseAudioBlock
                        key={index}
                        referenceAudioId={block.referenceAudioId}
                      />
                    );
                  if (block.type === "DIAGRAM")
                    return (
                      <section
                        key={index}
                        className="rounded-[20px] border border-[#e5deff] bg-[#f7f7f9] p-6 text-center"
                      >
                        <CircleAlert
                          className="mx-auto size-10 text-primary"
                          strokeWidth={1.7}
                        />
                        <p className="mt-3 text-sm leading-6">
                          {block.diagram.altText}
                        </p>
                      </section>
                    );
                  return null;
                })}
              </div>
            ) : !stepDetailError ? (
              <section className="flex min-h-52 items-center justify-center rounded-[20px] bg-[#f7f7f9] text-sm text-muted-foreground">
                단계별 교육 내용을 불러오는 중…
              </section>
            ) : null}
            <section className="design-card">
              <h3 className="mb-3 text-sm font-semibold">이번 연습의 목표</h3>
              <p className="text-sm leading-7">
                {content?.description ??
                  description ??
                  "예시를 듣고 문장을 따라 읽어 보세요."}
              </p>
            </section>
          </>
        )}
      </div>
      <div className="design-dock">
        <button
          type="button"
          disabled={example && !examples?.items.length}
          onClick={() =>
            example
              ? examples?.items.length &&
                onPractice(
                  [...examples.items].sort((a, b) => a.order - b.order)[0],
                  examples.revision,
                )
              : setPanel("open")
          }
          className="design-action"
        >
          {example ? "전체 문장 연습하기" : "예문 확인하기"}
        </button>
      </div>
    </div>
  );
}

function CourseAudioBlock({
  referenceAudioId,
}: {
  referenceAudioId: string | number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAudio() {
    setLoading(true);
    setError(null);
    try {
      const result =
        await api.content.getReferenceAudioPlaybackUrl(referenceAudioId);
      setUrl(result.playbackUrl);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "기준 음성을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="design-card">
      <h3 className="mb-3 text-sm font-semibold">기준 음성</h3>
      {url ? (
        <audio controls preload="none" src={url} className="w-full" />
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadAudio()}
          className="h-10 rounded-full bg-[#f1edff] px-4 text-sm font-medium text-primary disabled:opacity-60"
        >
          {loading ? "불러오는 중…" : "기준 음성 듣기"}
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
