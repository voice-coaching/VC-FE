"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CourseLesson } from "@/components/course-lesson";
import {
  ApiError,
  api,
  type CourseDetail,
  type CourseStep,
  type CourseProgress,
  type CourseSummary,
  type CourseType,
  type UserCourseProgress,
} from "@/lib/api";
import type { PracticeExample } from "@/lib/api";

function progressMap(items: UserCourseProgress[]) {
  return Object.fromEntries(items.map((item) => [String(item.courseId), item]));
}

function mergeProgress(
  courses: CourseSummary[],
  progressByCourse: Record<string, UserCourseProgress>,
) {
  return courses.map((course) => ({
    ...course,
    progressPercent: Math.min(
      100,
      Math.max(0, progressByCourse[String(course.id)]?.progressPercent ?? 0),
    ),
  }));
}

export function CourseCatalog({
  type,
  title,
  description,
}: {
  type?: CourseType;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const [lesson, setLesson] = useState<{
    course: CourseSummary;
    step: CourseStep;
    count: number;
  } | null>(null);
  const activeType = type ?? "PRONUNCIATION";
  const [indicatorType, setIndicatorType] = useState<CourseType>(activeType);
  const tabNavigationTimer = useRef<number | null>(null);
  const [stepsByCourse, setStepsByCourse] = useState<
    Record<string, CourseStep[]>
  >({});
  const [items, setItems] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [progressByCourse, setProgressByCourse] = useState<
    Record<string, UserCourseProgress>
  >({});
  const [startingId, setStartingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailsByCourse, setDetailsByCourse] = useState<
    Record<string, CourseDetail>
  >({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIndicatorType(activeType);
    return () => {
      if (tabNavigationTimer.current !== null) {
        window.clearTimeout(tabNavigationTimer.current);
      }
    };
  }, [activeType]);

  function navigateToType(
    event: MouseEvent<HTMLAnchorElement>,
    nextType: CourseType,
    href: string,
  ) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    event.preventDefault();
    if (tabNavigationTimer.current !== null) {
      window.clearTimeout(tabNavigationTimer.current);
      tabNavigationTimer.current = null;
    }
    setIndicatorType(nextType);
    if (nextType === activeType) return;

    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 280;
    if (delay === 0) {
      router.push(href);
      return;
    }
    tabNavigationTimer.current = window.setTimeout(() => {
      router.push(href);
      tabNavigationTimer.current = null;
    }, delay);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.courses.list({
        type: activeType,
        status: "PUBLISHED",
        page: 0,
        size: 20,
      }),
      api.courses.getMyProgress(),
    ])
      .then(([result, userProgress]) => {
        if (!active) return;
        const byCourse = progressMap(userProgress);
        setProgressByCourse(byCourse);
        setItems(mergeProgress(result.items, byCourse));
        void Promise.allSettled(
          result.items.map((course) => api.courses.get(course.id)),
        ).then((results) => {
          if (!active) return;
          setDetailsByCourse((current) => ({
            ...current,
            ...Object.fromEntries(
              results.flatMap((result) =>
                result.status === "fulfilled"
                  ? [[String(result.value.id), result.value]]
                  : [],
              ),
            ),
          }));
        });
        setPage(result.page);
        setHasNext(
          result.hasNext ?? result.page + 1 < (result.totalPages ?? 0),
        );
      })
      .catch(
        (reason) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "클래스를 불러오지 못했습니다.",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [activeType]);

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const result = await api.courses.list({
        type: activeType,
        status: "PUBLISHED",
        page: page + 1,
        size: 20,
      });
      setItems((current) => [
        ...current,
        ...mergeProgress(result.items, progressByCourse),
      ]);
      setPage(result.page);
      setHasNext(result.hasNext ?? result.page + 1 < (result.totalPages ?? 0));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "클래스를 더 불러오지 못했습니다.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function start(course: CourseSummary, requestedStep?: CourseStep) {
    setStartingId(String(course.id));
    setError(null);
    try {
      const savedProgress = progressByCourse[String(course.id)];
      let replayFromStart = course.progressPercent >= 100;
      let currentProgress: CourseProgress | undefined = savedProgress;

      if (savedProgress) {
        try {
          currentProgress = await api.courses.getProgress(course.id);
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 404) {
            currentProgress = await api.courses.start(course.id);
          } else {
            throw reason;
          }
        }
      } else {
        try {
          currentProgress = await api.courses.start(course.id);
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 409) {
            currentProgress = await api.courses.getProgress(course.id);
          } else {
            throw reason;
          }
        }
      }
      replayFromStart =
        replayFromStart || currentProgress?.status === "COMPLETED";

      const steps = (await api.courses.getSteps(course.id)).sort(
        (a, b) => a.stepOrder - b.stepOrder,
      );
      const lastStepIndex = steps.findIndex(
        (step) => String(step.id) === String(currentProgress?.lastStepId),
      );
      const remainingSteps = replayFromStart
        ? steps
        : lastStepIndex >= 0
          ? steps.slice(
              (currentProgress?.progressPercent ?? 0) > 0
                ? lastStepIndex + 1
                : lastStepIndex,
            )
          : steps;
      const requestedPractice = requestedStep
        ? steps.find(
            (step) =>
              step.stepOrder >= requestedStep.stepOrder &&
              step.practiceContentId != null,
          )
        : undefined;
      const practice =
        requestedPractice ??
        remainingSteps.find((step) => step.practiceContentId != null) ??
        steps.find((step) => step.practiceContentId != null);
      if (!practice?.practiceContentId)
        throw new Error("이 클래스의 연습 콘텐츠가 아직 준비되지 않았습니다.");
      setLesson({
        course,
        step: requestedStep
          ? { ...practice, title: requestedStep.title }
          : practice,
        count: steps.length,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "클래스를 시작하지 못했습니다.",
      );
    } finally {
      setStartingId(null);
    }
  }

  async function toggleDetails(course: CourseSummary) {
    const key = String(course.id);
    if (expandedId === key) {
      setExpandedId(null);
      return;
    }
    setExpandedId(key);
    const cachedDetail = detailsByCourse[key];
    const cachedSteps = stepsByCourse[key];
    if (cachedDetail && cachedSteps) return;

    setDetailLoadingId(key);
    setError(null);
    try {
      const [detail, steps] = await Promise.all([
        cachedDetail
          ? Promise.resolve(cachedDetail)
          : api.courses.get(course.id),
        cachedSteps
          ? Promise.resolve(cachedSteps)
          : api.courses.getSteps(course.id),
      ]);
      setStepsByCourse((current) => ({
        ...current,
        [key]: steps.sort((a, b) => a.stepOrder - b.stepOrder),
      }));
      setDetailsByCourse((current) => ({ ...current, [key]: detail }));
    } catch (reason) {
      setExpandedId(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "클래스 상세를 불러오지 못했습니다.",
      );
    } finally {
      setDetailLoadingId(null);
    }
  }

  const selectedCourse = items.find((item) => String(item.id) === expandedId);
  const detail = expandedId ? detailsByCourse[expandedId] : undefined;
  const steps = expandedId ? (stepsByCourse[expandedId] ?? []) : [];
  const level = (value: CourseSummary["difficulty"]) =>
    ({ BEGINNER: "초급", INTERMEDIATE: "중급", ADVANCED: "고급" })[value];

  if (lesson)
    return (
      <AppShell nav={false}>
        <CourseLesson
          key={`${lesson.course.id}:${lesson.step.id}`}
          course={lesson.course}
          step={lesson.step}
          stepCount={lesson.count}
          description={detailsByCourse[String(lesson.course.id)]?.description}
          onClose={() => setLesson(null)}
          onPractice={(example: PracticeExample, revision: number) => {
            const params = new URLSearchParams({
              courseId: String(lesson.course.id),
              courseStepId: String(lesson.step.id),
              returnTo: type ? `/class/${type.toLowerCase()}` : "/class",
              exampleId: example.id,
              exampleRevision: String(revision),
            });
            router.push(
              `/practice/${example.practiceContentId}?${params.toString()}`,
            );
          }}
        />
      </AppShell>
    );

  return (
    <AppShell
      nav={!selectedCourse}
      chromeColor="#f2f4f6"
      className="bg-[#f2f4f6]"
    >
      <header className="relative flex h-12 shrink-0 items-center px-2 py-1">
        {selectedCourse ? (
          <button
            type="button"
            onClick={() => setExpandedId(null)}
            aria-label="클래스 목록으로 돌아가기"
            className="flex size-10 items-center justify-center"
          >
            <Image
              src="/figma/home/chevron-left.svg"
              alt=""
              width={24}
              height={24}
            />
          </button>
        ) : (
          <Link
            href="/home"
            aria-label="홈으로 돌아가기"
            className="flex size-10 items-center justify-center"
          >
            <Image
              src="/figma/home/chevron-left.svg"
              alt=""
              width={24}
              height={24}
            />
          </Link>
        )}
        <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold">
          {selectedCourse?.title ?? "클래스"}
        </h1>
      </header>
      <div className="flex min-h-[calc(100dvh-80px)] flex-col">
        <div className={selectedCourse ? "px-5 pb-6" : "pb-6"}>
          <p className="sr-only">
            {title} · {description}
          </p>
          {!selectedCourse && (
            <nav
              className="relative mx-5 mb-4 grid h-[58px] grid-cols-2 border-b border-[#dfe3e7]"
              aria-label="클래스 유형"
            >
              <span
                aria-hidden="true"
                data-active-indicator={indicatorType.toLowerCase()}
                className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/2 bg-[#191f28] transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                style={{
                  transform:
                    indicatorType === "INTONATION"
                      ? "translate3d(100%, 0, 0)"
                      : "translate3d(0, 0, 0)",
                }}
              />
              <Link
                href="/class/pronunciation"
                onClick={(event) =>
                  navigateToType(event, "PRONUNCIATION", "/class/pronunciation")
                }
                aria-current={
                  indicatorType === "PRONUNCIATION" ? "page" : undefined
                }
                className={`relative z-10 flex items-center justify-center px-1 pt-2 text-center text-[15px] transition-colors duration-200 ${
                  indicatorType === "PRONUNCIATION"
                    ? "font-bold text-[#191f28]"
                    : "font-medium text-[#8b95a1]"
                }`}
              >
                발음 클래스
              </Link>
              <Link
                href="/class/intonation"
                onClick={(event) =>
                  navigateToType(event, "INTONATION", "/class/intonation")
                }
                aria-current={
                  indicatorType === "INTONATION" ? "page" : undefined
                }
                className={`relative z-10 flex items-center justify-center px-1 pt-2 text-center text-[15px] transition-colors duration-200 ${
                  indicatorType === "INTONATION"
                    ? "font-bold text-[#191f28]"
                    : "font-medium text-[#8b95a1]"
                }`}
              >
                억양 클래스
              </Link>
            </nav>
          )}
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {selectedCourse ? (
            <>
              <div className="flex gap-3 pt-2 text-xs font-medium">
                <span className="rounded-full bg-[#edf2ff] px-2.5 py-1 text-primary">
                  {level(selectedCourse.difficulty)}
                </span>
                {detail ? (
                  <span className="px-0 py-1 text-[#6b7684]">
                    {detail.stepCount}단계
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 text-[22px] leading-8 font-bold tracking-[-0.02em]">
                {detail?.description || selectedCourse.title}
              </h2>
              <p className="mt-1 text-sm leading-5 text-[#6b7684]">
                발음 원리를 단계별로 익히고 직접 소리 내어 연습해요
              </p>
              <section className="mt-4 rounded-2xl bg-white p-4 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
                <strong className="block text-[15px] leading-[22px]">
                  이 클래스를 마치면
                </strong>
                <p className="mt-1 text-[13px] leading-[18px] text-[#4e5968]">
                  {detail?.description ?? "학습 내용을 불러오는 중이에요"}
                </p>
              </section>
              <div className="mt-5 mb-3 flex justify-between">
                <h3 className="text-[17px] leading-6 font-bold">구성 단계</h3>
                <span className="text-[13px] leading-[18px] text-[#8b95a1]">
                  {steps.length}단계
                </span>
              </div>
              <ol className="divide-y divide-[#e5e8eb] rounded-2xl bg-white px-4">
                {steps.map((step, index) => {
                  const firstIncomplete = steps.findIndex(
                    (item) => !item.completed,
                  );
                  const locked =
                    !step.completed &&
                    firstIncomplete >= 0 &&
                    index > firstIncomplete;
                  return (
                    <li key={String(step.id)}>
                      <button
                        type="button"
                        disabled={locked || startingId !== null}
                        onClick={() => void start(selectedCourse, step)}
                        className="flex min-h-[57px] w-full items-center gap-3 text-left disabled:cursor-default"
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-medium ${step.completed ? "bg-primary text-white" : locked ? "bg-[#f2f4f6] text-[#b0b8c1]" : "border-2 border-primary text-primary"}`}
                        >
                          {step.completed ? (
                            <Check className="size-4" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span
                          className={`flex-1 text-[15px] leading-[22px] font-medium ${locked ? "text-[#b0b8c1]" : "text-[#333d4b]"}`}
                        >
                          {step.title}
                        </span>
                        {!locked ? (
                          <ChevronRight className="size-5 text-[#b0b8c1]" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              클래스를 불러오는 중…
            </p>
          ) : (
            <div className="space-y-3 px-5">
              {items.map((course) => {
                const detail = detailsByCourse[String(course.id)];
                const progress = Math.max(
                  0,
                  Math.min(100, course.progressPercent),
                );
                return (
                  <button
                    key={String(course.id)}
                    type="button"
                    onClick={() => void toggleDetails(course)}
                    className="flex min-h-[118px] w-full items-start gap-3.5 rounded-2xl bg-white p-[18px] text-left"
                  >
                    <span
                      className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${activeType === "PRONUNCIATION" ? "bg-[#ccddff]" : "bg-[#edf2ff]"}`}
                    >
                      <Image
                        src={
                          activeType === "PRONUNCIATION"
                            ? "/figma/class/icon.svg"
                            : "/figma/class/falling.svg"
                        }
                        alt=""
                        width={28}
                        height={28}
                        className="size-7"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-[15px] leading-[22px] font-bold">
                          {course.title}
                        </h2>
                        <span
                          className={`shrink-0 text-xs ${progress > 0 ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {detail
                            ? `${Math.round((progress / 100) * detail.stepCount)}/${detail.stepCount}`
                            : `${Math.round(progress)}%`}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs leading-4 text-[#8b95a1]">
                        {detail?.description || "원리부터 차근차근 연습해요"}
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dfe3e7]">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] leading-[14px] text-[#8b95a1]">
                        {detail
                          ? `${detail.stepCount}단계`
                          : "단계 정보 불러오는 중"}
                      </p>
                    </div>
                  </button>
                );
              })}
              {items.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  조건에 맞는 클래스가 없습니다.
                </p>
              )}
              {hasNext && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  className="design-action"
                >
                  {loadingMore ? "불러오는 중…" : "클래스 더 보기"}
                </button>
              )}
            </div>
          )}
        </div>
        {selectedCourse && (
          <div className="design-dock">
            <button
              type="button"
              disabled={
                startingId === String(selectedCourse.id) ||
                detailLoadingId !== null
              }
              onClick={() => void start(selectedCourse)}
              className="design-action"
            >
              {startingId
                ? "시작 중…"
                : selectedCourse.progressPercent >= 100
                  ? "다시 학습하기"
                  : selectedCourse.progressPercent > 0
                    ? "이어서 학습하기"
                    : "학습 시작하기"}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
