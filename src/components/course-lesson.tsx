"use client";

import { useEffect, useState } from "react";
import { CircleAlert, X } from "lucide-react";
import {
  api,
  type CourseStepDetail,
  type CourseSummary,
  type CourseStep,
  type PracticeContent,
  type PracticeExample,
  type PracticeExamples,
} from "@/lib/api";
import { TtsPracticePlayer } from "@/components/tts-practice-player";
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
  stepCount,
  description,
  onClose,
  onPractice,
}: {
  course: CourseSummary;
  step: CourseStep;
  stepCount: number;
  description?: string;
  onClose: () => void;
  onPractice: (example: PracticeExample, revision: number) => void;
}) {
  const userId = getAuthenticatedUserId();
  const cacheResource = cacheResources.courseLesson(course.id, step.id);
  const [initialCache] = useState(() =>
    readUserClientCache<CourseLessonCache>(userId, cacheResource),
  );
  const [example, setExample] = useState(false);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);
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
  }, [cacheResource, course.id, step.id, userId]);
  useEffect(() => {
    let active = true;
    const cached = readUserClientCache<CourseLessonCache>(
      userId,
      cacheResource,
    );
    setExamples(cached?.examples ?? null);
    setExampleError(null);
    setSelectedExampleIndex(0);
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
  }, [practiceContentId, userId]);
  const selectedExample = examples?.items[selectedExampleIndex];
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 pt-8 pb-5">
        <button type="button" aria-label="학습 닫기" onClick={onClose}>
          <X className="size-5" />
        </button>
        <h1 className="text-lg font-bold">{step.stepOrder}단계</h1>
        <span className="text-xs text-muted-foreground">
          {step.stepOrder}/{stepCount}
        </span>
      </header>
      <div className="mx-5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width: `${Math.min(100, (step.stepOrder / Math.max(1, stepCount)) * 100)}%`,
          }}
        />
      </div>
      <div className="space-y-5 px-5 py-6">
        <div>
          <h2 className="text-[23px] font-bold">
            {example
              ? "예시를 듣고 따라 해보세요"
              : (stepDetail?.title ?? step.title)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {example
              ? "문장 속 발음과 억양에 집중해서 들어보세요"
              : (stepDetail?.subtitle ?? content?.description ?? description)}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {stepDetailError && !example ? (
          <p role="alert" className="text-sm text-destructive">
            {stepDetailError}
          </p>
        ) : null}
        {example ? (
          <>
            <div className="flex items-end justify-between gap-3 pt-1">
              <div>
                <h3 className="text-base font-semibold">
                  연습 문제 {examples?.items.length ?? 0}개
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  한 문장을 골라 음성을 듣고 따라 읽어보세요.
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-primary">
                {selectedExample ? selectedExampleIndex + 1 : 0}/
                {examples?.items.length ?? 0}
              </span>
            </div>
            {exampleError ? (
              <div role="alert">
                <p>{exampleError}</p>
                <button
                  type="button"
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
            <ol className="space-y-2.5">
              {examples?.items.map((practiceExample, index) => {
                const selected = index === selectedExampleIndex;
                return (
                  <li key={practiceExample.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedExampleIndex(index)}
                      className={`flex w-full gap-3 rounded-2xl border p-4 text-left ${selected ? "border-primary bg-[#edf2ff]" : "border-border bg-white"}`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                      >
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
                    </button>
                  </li>
                );
              })}
            </ol>
            {selectedExample && examples && (
              <TtsPracticePlayer
                key={`${selectedExample.id}:${examples.revision}`}
                example={selectedExample}
              />
            )}
          </>
        ) : (
          <>
            {stepDetail ? (
              <div className="space-y-3">
                {stepDetail.blocks.map((block, index) => {
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
                        className="overflow-hidden rounded-[20px] bg-[#f4f9ff]"
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
                        className="rounded-[20px] border border-[#bfdcff] bg-[#f4f9ff] p-6 text-center"
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
                  return (
                    <p
                      key={index}
                      className="rounded-2xl bg-[#edf2ff] p-4 text-sm text-primary"
                    >
                      이어지는 예문으로 직접 연습해 보세요.
                    </p>
                  );
                })}
              </div>
            ) : !stepDetailError ? (
              <section className="flex min-h-52 items-center justify-center rounded-[20px] bg-[#f4f9ff] text-sm text-muted-foreground">
                단계별 교육 내용을 불러오는 중…
              </section>
            ) : null}
            <section className="design-card">
              <h3 className="mb-3 text-sm font-semibold">학습 안내</h3>
              <p className="text-sm leading-7">
                {content?.description ??
                  description ??
                  "예시를 듣고 문장을 따라 읽어보세요."}
              </p>
            </section>
          </>
        )}
      </div>
      <div className="design-dock">
        <button
          type="button"
          disabled={example && !selectedExample}
          onClick={() =>
            example
              ? selectedExample &&
                examples &&
                onPractice(selectedExample, examples.revision)
              : setExample(true)
          }
          className="design-action"
        >
          {example ? "선택한 문제 따라 읽기" : "예시 들어보기"}
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
          className="h-10 rounded-full bg-[#edf2ff] px-4 text-sm font-medium text-primary disabled:opacity-60"
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
