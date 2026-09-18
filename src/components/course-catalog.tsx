"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Check, ChevronRight, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CourseLesson } from "@/components/course-lesson";
import { TopBar } from "@/components/top-bar";
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
import type { PracticeExample } from "@/lib/practice-examples";

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
          course={lesson.course}
          step={lesson.step}
          stepCount={lesson.count}
          description={detailsByCourse[String(lesson.course.id)]?.description}
          onClose={() => setLesson(null)}
          onPractice={(example: PracticeExample) => {
            const params = new URLSearchParams({
              courseId: String(lesson.course.id),
              courseStepId: String(lesson.step.id),
              returnTo: type ? `/class/${type.toLowerCase()}` : "/class",
              exampleId: example.id,
            });
            router.push(
              `/practice/${lesson.step.practiceContentId}?${params.toString()}`,
            );
          }}
        />
      </AppShell>
    );

  return (
    <AppShell nav={!selectedCourse}>
      <TopBar
        to="/home"
        onBack={selectedCourse ? () => setExpandedId(null) : undefined}
        title={selectedCourse?.title ?? "클래스"}
      />
      <div className="flex min-h-[calc(100dvh-80px)] flex-col">
        <div className="px-5 pb-6">
          <p className="sr-only">
            {title} · {description}
          </p>
          {!selectedCourse && (
            <nav
              className="relative mb-5 grid grid-cols-2 gap-1 rounded-xl bg-[#f3f4f5] p-1"
              aria-label="클래스 유형"
            >
              <span
                aria-hidden="true"
                data-active-indicator={indicatorType.toLowerCase()}
                className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%_-_6px)] rounded-[9px] bg-white shadow-[0_2px_5px_#0000000a] transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                style={{
                  transform:
                    indicatorType === "INTONATION"
                      ? "translate3d(calc(100% + 4px), 0, 0)"
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
                className={`relative z-10 rounded-[9px] px-1 py-2.5 text-center text-sm transition-colors duration-200 ${
                  indicatorType === "PRONUNCIATION"
                    ? "font-semibold text-[#191f28]"
                    : "text-[#8b929a]"
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
                className={`relative z-10 rounded-[9px] px-1 py-2.5 text-center text-sm transition-colors duration-200 ${
                  indicatorType === "INTONATION"
                    ? "font-semibold text-[#191f28]"
                    : "text-[#8b929a]"
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
              <div className="mb-3 flex gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-2 py-1">
                  {level(selectedCourse.difficulty)}
                </span>
                {detail && (
                  <span className="rounded bg-muted px-2 py-1">
                    {detail.stepCount}단계
                  </span>
                )}
                <span className="rounded bg-muted px-2 py-1">
                  약 {selectedCourse.estimatedMinutes}분
                </span>
              </div>
              <h2 className="text-2xl font-bold">{selectedCourse.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {detail?.description ?? "상세 정보를 불러오는 중…"}
              </p>
              <section className="my-5 rounded-[20px] bg-[#edf2ff] p-5 text-primary">
                <div className="mb-4 flex justify-between text-sm">
                  <span>진행 상황</span>
                  <b>{Math.round(selectedCourse.progressPercent)}%</b>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${selectedCourse.progressPercent}%` }}
                  />
                </div>
                {steps.find((step) => !step.completed) && (
                  <p className="mt-3 text-xs">
                    다음: {steps.find((step) => !step.completed)?.title}
                  </p>
                )}
              </section>
              <div className="mb-4 flex justify-between">
                <h3 className="text-base font-semibold">구성 단계</h3>
                <span className="text-sm text-muted-foreground">
                  {steps.length}단계
                </span>
              </div>
              <ol className="design-card divide-y divide-border !py-0">
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
                        className="flex w-full items-center gap-3 py-4 text-left disabled:cursor-default disabled:opacity-35"
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm ${step.completed ? "bg-primary text-white" : locked ? "bg-muted text-muted-foreground" : "border border-primary text-primary"}`}
                        >
                          {step.completed ? (
                            <Check className="size-4" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span className="flex-1 text-sm font-medium">
                          {step.title}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" />
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
            <div className="space-y-3">
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
                    className="design-card flex w-full items-start gap-3.5 !p-[18px] text-left"
                  >
                    <span
                      className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${activeType === "PRONUNCIATION" ? "bg-[#ccddff]" : "bg-[#edf2ff]"}`}
                    >
                      <Image
                        src={
                          activeType === "PRONUNCIATION"
                            ? "/figma/class/icon.svg"
                            : /의문/.test(course.title)
                              ? "/figma/class/rising.svg"
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
                        <h2 className="text-[15px] font-bold">
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
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {detail?.description || "원리부터 차근차근 연습해요"}
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e8eb]">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {level(course.difficulty)}　
                        {detail ? `|　${detail.stepCount}단계　` : ""}|　약{" "}
                        {course.estimatedMinutes}분
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
