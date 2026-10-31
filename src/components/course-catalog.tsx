"use client";

import { SkeletonBlock } from "@/components/skeleton-block";
import Link from "next/link";
import Image from "next/image";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import styles from "./course-catalog.module.css";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import {
  ApiError,
  api,
  type CourseDetail,
  type PracticeExamples,
  type CourseSummary,
  type CourseType,
  type UserCourseProgress,
} from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import { readUserClientCache, updateUserClientCache } from "@/lib/client-cache";
import { useHistoryPanel } from "@/hooks/use-history-panel";
import { useHistoryScroll } from "@/hooks/use-history-scroll";
import { refreshCatalogWindow } from "@/lib/catalog-pages";
import {
  classExamplesErrorMessage,
  classPracticeHref,
  orderedCourseExamples,
} from "@/lib/class-practice";

type CourseCatalogCache = {
  items: CourseSummary[];
  page: number;
  hasNext: boolean;
  progressByCourse: Record<string, UserCourseProgress>;
  detailsByCourse: Record<string, CourseDetail>;
  examplesByCourse: Record<string, PracticeExamples>;
};

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

type CourseCatalogProps = {
  type?: CourseType;
  title: string;
  description: string;
};

export function CourseCatalog(props: CourseCatalogProps) {
  return (
    <Suspense
      fallback={
        <AppShell>
          <CourseListSkeleton />
        </AppShell>
      }
    >
      <CourseCatalogView {...props} />
    </Suspense>
  );
}

function CourseCatalogView({
  type,
  title,
  description,
}: {
  type?: CourseType;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const userId = getAuthenticatedUserId();
  const pathname = usePathname();
  const activeType: CourseType =
    pathname === "/class/intonation"
      ? "INTONATION"
      : pathname === "/class" || pathname === "/class/pronunciation"
        ? "PRONUNCIATION"
        : (type ?? "PRONUNCIATION");
  const cacheResource = cacheResources.courseCatalog(activeType);
  const [initialCache] = useState(() =>
    readUserClientCache<CourseCatalogCache>(userId, cacheResource),
  );
  const [loadedType, setLoadedType] = useState(activeType);
  const [examplesByCourse, setExamplesByCourse] = useState<
    Record<string, PracticeExamples>
  >(initialCache?.examplesByCourse ?? {});
  const [items, setItems] = useState<CourseSummary[]>(
    initialCache?.items ?? [],
  );
  const [loading, setLoading] = useState(initialCache === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const listGeneration = useRef(0);
  const loadMoreBusy = useRef(false);
  const [page, setPage] = useState(initialCache?.page ?? 0);
  const [hasNext, setHasNext] = useState(initialCache?.hasNext ?? false);
  const [progressByCourse, setProgressByCourse] = useState<
    Record<string, UserCourseProgress>
  >(initialCache?.progressByCourse ?? {});
  const [startingId, setStartingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useHistoryPanel(
    "course",
    items.map((item) => String(item.id)),
  );
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailsByCourse, setDetailsByCourse] = useState<
    Record<string, CourseDetail>
  >(initialCache?.detailsByCourse ?? {});
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRetry, setDetailRetry] = useState(0);
  const startBusy = useRef(false);
  const lifecycle = useRef(0);

  useEffect(() => {
    lifecycle.current += 1;
    startBusy.current = false;
    setStartingId(null);
    setDetailError(null);
    setError(null);
    return () => {
      lifecycle.current += 1;
    };
  }, [activeType, userId, expandedId]);

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
    if (nextType === activeType) return;
    // Keep the tab bar mounted; Next synchronizes usePathname with native history.
    window.history.pushState(null, "", href);
  }

  useLayoutEffect(() => {
    let active = true;
    listGeneration.current += 1;
    loadMoreBusy.current = false;
    setLoadingMore(false);
    setLoadMoreError(null);
    setRefreshing(true);
    setLoadedType(activeType);
    const cached = readUserClientCache<CourseCatalogCache>(
      userId,
      cacheResource,
    );
    if (cached) {
      setItems(cached.items);
      setPage(cached.page);
      setHasNext(cached.hasNext);
      setProgressByCourse(cached.progressByCourse);
      setDetailsByCourse(cached.detailsByCourse);
      setExamplesByCourse(cached.examplesByCourse ?? {});
      setLoading(false);
    } else {
      setItems([]);
      setPage(0);
      setHasNext(false);
      setProgressByCourse({});
      setDetailsByCourse({});
      setExamplesByCourse({});
      setLoading(true);
    }
    setError(null);
    Promise.all([
      refreshCatalogWindow(
        (page) =>
          api.courses.list({
            type: activeType,
            status: "PUBLISHED",
            page,
            size: 20,
          }),
        cached?.page ?? 0,
        () => active,
      ),
      api.courses.getMyProgress(),
    ])
      .then(([result, userProgress]) => {
        if (!active || !result) return;
        const byCourse = progressMap(userProgress);
        const nextItems = mergeProgress(result.items, byCourse);
        const nextHasNext =
          result.hasNext ?? result.page + 1 < (result.totalPages ?? 0);
        setProgressByCourse(byCourse);
        setItems(nextItems);
        setPage(result.page);
        setHasNext(nextHasNext);
        const currentCache = readUserClientCache<CourseCatalogCache>(
          userId,
          cacheResource,
        );
        updateUserClientCache<CourseCatalogCache>(userId, cacheResource, {
          items: nextItems,
          page: result.page,
          hasNext: nextHasNext,
          progressByCourse: byCourse,
          detailsByCourse: currentCache?.detailsByCourse ?? {},
          examplesByCourse: currentCache?.examplesByCourse ?? {},
        });
        void Promise.allSettled(
          result.items
            .filter((course) => !cached?.detailsByCourse[String(course.id)])
            .map((course) => api.courses.get(course.id)),
        ).then((results) => {
          if (!active) return;
          const loadedDetails = Object.fromEntries(
            results.flatMap((detailResult) =>
              detailResult.status === "fulfilled"
                ? [[String(detailResult.value.id), detailResult.value]]
                : [],
            ),
          );
          const nextDetails = {
            ...(readUserClientCache<CourseCatalogCache>(userId, cacheResource)
              ?.detailsByCourse ?? {}),
            ...loadedDetails,
          };
          setDetailsByCourse(nextDetails);
          updateUserClientCache<CourseCatalogCache>(userId, cacheResource, {
            detailsByCourse: nextDetails,
          });
        });
      })
      .catch(
        (reason) =>
          active &&
          !cached &&
          setError(
            reason instanceof Error
              ? reason.message
              : "클래스를 불러오지 못했습니다.",
          ),
      )
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
      listGeneration.current += 1;
    };
  }, [activeType, cacheResource, userId, retry]);

  async function loadMore() {
    if (loadMoreBusy.current || refreshing || !hasNext) return;
    loadMoreBusy.current = true;
    const requestGeneration = listGeneration.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await api.courses.list({
        type: activeType,
        status: "PUBLISHED",
        page: page + 1,
        size: 20,
      });
      if (requestGeneration !== listGeneration.current) return;
      const merged = new Map(items.map((item) => [String(item.id), item]));
      for (const item of mergeProgress(result.items, progressByCourse))
        merged.set(String(item.id), item);
      const nextItems = [...merged.values()];
      setItems(nextItems);
      const nextHasNext =
        result.hasNext ?? result.page + 1 < (result.totalPages ?? 0);
      setPage(result.page);
      setHasNext(nextHasNext);
      updateUserClientCache<CourseCatalogCache>(userId, cacheResource, {
        items: nextItems,
        page: result.page,
        hasNext: nextHasNext,
      });
    } catch (reason) {
      if (requestGeneration !== listGeneration.current) return;
      setLoadMoreError(
        reason instanceof Error
          ? reason.message
          : "클래스를 더 불러오지 못했습니다.",
      );
    } finally {
      if (requestGeneration === listGeneration.current) {
        loadMoreBusy.current = false;
        setLoadingMore(false);
      }
    }
  }

  async function start(course: CourseSummary) {
    if (startBusy.current) return;
    startBusy.current = true;
    const requestLifecycle = lifecycle.current;
    setStartingId(String(course.id));
    setError(null);
    try {
      const key = String(course.id);
      const savedProgress = progressByCourse[key];

      if (savedProgress) {
        try {
          await api.courses.getProgress(course.id);
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 404) {
            await api.courses.start(course.id);
          } else {
            throw reason;
          }
        }
      } else {
        try {
          await api.courses.start(course.id);
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 409) {
            await api.courses.getProgress(course.id);
          } else {
            throw reason;
          }
        }
      }
      if (requestLifecycle !== lifecycle.current) return;

      const examples = orderedCourseExamples(
        examplesByCourse[key] ?? (await api.examples.listCourse(course.id)),
        course.id,
      );
      if (requestLifecycle !== lifecycle.current) return;
      const nextExamples = {
        ...examplesByCourse,
        [key]: examples,
      };
      setExamplesByCourse(nextExamples);
      updateUserClientCache<CourseCatalogCache>(userId, cacheResource, {
        examplesByCourse: nextExamples,
      });
      router.push(
        classPracticeHref(
          examples,
          0,
          `${window.location.pathname}${window.location.search}`,
        ),
      );
    } catch (reason) {
      if (requestLifecycle !== lifecycle.current) return;
      setError(classExamplesErrorMessage(reason));
    } finally {
      if (requestLifecycle === lifecycle.current) {
        startBusy.current = false;
        setStartingId(null);
      }
    }
  }

  useEffect(() => {
    if (!expandedId) return;
    let active = true;
    const key = expandedId;
    const cachedDetail = detailsByCourse[key];
    const cachedExamples = examplesByCourse[key];
    if (cachedDetail && cachedExamples) {
      setDetailLoadingId(null);
      return;
    }

    setDetailLoadingId(key);
    setDetailError(null);
    void Promise.all([
      cachedDetail ? Promise.resolve(cachedDetail) : api.courses.get(key),
      cachedExamples
        ? Promise.resolve(cachedExamples)
        : api.examples.listCourse(key),
    ])
      .then(([detail, exampleResponse]) => {
        if (!active) return;
        const examples = orderedCourseExamples(exampleResponse, key);
        const nextExamples = {
          ...examplesByCourse,
          [key]: examples,
        };
        const nextDetails = { ...detailsByCourse, [key]: detail };
        setExamplesByCourse(nextExamples);
        setDetailsByCourse(nextDetails);
        updateUserClientCache<CourseCatalogCache>(userId, cacheResource, {
          examplesByCourse: nextExamples,
          detailsByCourse: nextDetails,
        });
      })
      .catch((reason) => {
        if (!active) return;
        setDetailError(classExamplesErrorMessage(reason));
      })
      .finally(() => {
        if (active) setDetailLoadingId(null);
      });
    return () => {
      active = false;
    };
  }, [
    expandedId,
    detailsByCourse,
    examplesByCourse,
    cacheResource,
    userId,
    detailRetry,
  ]);

  const selectedCourse = items.find((item) => String(item.id) === expandedId);
  const detail = expandedId ? detailsByCourse[expandedId] : undefined;
  const courseExamples = expandedId ? examplesByCourse[expandedId] : undefined;
  const scrollRef = useHistoryScroll(
    `${userId}:courses:${activeType}:${expandedId ?? "list"}`,
    !loading,
  );
  const level = (value: CourseSummary["difficulty"]) =>
    ({ BEGINNER: "초급", INTERMEDIATE: "중급", ADVANCED: "고급" })[value];

  return (
    <AppShell
      nav={!selectedCourse}
      animateRoute={false}
      viewportLocked
      chromeColor="#f2f4f6"
      className="flex min-h-0 flex-col bg-[#f2f4f6]"
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
          <BackButton
            fallback={type ? "/class" : "/home"}
            className="flex size-10 items-center justify-center"
          >
            <Image
              src="/figma/home/chevron-left.svg"
              alt=""
              width={24}
              height={24}
            />
          </BackButton>
        )}
        <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold">
          {selectedCourse?.title ?? "클래스"}
        </h1>
      </header>
      <div
        ref={scrollRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-wrap:anywhere]"
      >
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
                data-active-indicator={activeType.toLowerCase()}
                className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/2 bg-[#191f28] transition-transform duration-[320ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0"
                style={{
                  transform:
                    activeType === "INTONATION"
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
                  activeType === "PRONUNCIATION" ? "page" : undefined
                }
                className={`relative z-10 flex items-center justify-center px-1 pt-2 text-center text-[15px] transition-colors duration-150 motion-reduce:transition-none motion-reduce:duration-0 ${
                  activeType === "PRONUNCIATION"
                    ? "font-bold text-[#191f28]"
                    : "font-bold text-[#8b95a1]"
                }`}
              >
                발음 클래스
              </Link>
              <Link
                href="/class/intonation"
                onClick={(event) =>
                  navigateToType(event, "INTONATION", "/class/intonation")
                }
                aria-current={activeType === "INTONATION" ? "page" : undefined}
                className={`relative z-10 flex items-center justify-center px-1 pt-2 text-center text-[15px] transition-colors duration-150 motion-reduce:transition-none motion-reduce:duration-0 ${
                  activeType === "INTONATION"
                    ? "font-bold text-[#191f28]"
                    : "font-bold text-[#8b95a1]"
                }`}
              >
                억양 클래스
              </Link>
            </nav>
          )}
          <div
            key={
              selectedCourse
                ? "detail"
                : `${activeType}:${loadedType !== activeType || loading ? "loading" : "ready"}`
            }
            className={selectedCourse ? undefined : styles.panel}
            aria-busy={loadedType !== activeType || loading}
          >
            {error && loadedType === activeType && (
              <div className="mb-4 rounded-xl bg-destructive/5 p-4 text-sm text-destructive">
                <p role="alert">{error}</p>
                {!selectedCourse && items.length === 0 && !loading ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      setRetry((value) => value + 1);
                    }}
                    className="mt-1 min-h-11 px-2 font-semibold text-primary"
                  >
                    다시 시도
                  </button>
                ) : null}
              </div>
            )}
            {selectedCourse && detailError ? (
              <div className="mb-4 rounded-xl bg-destructive/5 p-4 text-sm text-destructive">
                <p role="alert">{detailError}</p>
                <button
                  type="button"
                  className="mt-1 min-h-11 font-semibold text-primary"
                  onClick={() => {
                    setDetailError(null);
                    setDetailRetry((value) => value + 1);
                  }}
                >
                  클래스 상세 다시 불러오기
                </button>
              </div>
            ) : null}
            {selectedCourse ? (
              <>
                <div className="flex gap-3 pt-2 text-xs font-medium">
                  <span className="rounded-full bg-[#edf2ff] px-2.5 py-1 text-primary">
                    {level(selectedCourse.difficulty)}
                  </span>
                  {courseExamples ? (
                    <span className="px-0 py-1 text-[#6b7684]">
                      {courseExamples.items.length}문장
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-[22px] leading-8 font-bold tracking-[-0.02em]">
                  {detail?.description || selectedCourse.title}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#6b7684]">
                  문장을 하나씩 녹음하고 평가를 확인하며 연습해요
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
                  <h3 className="text-[17px] leading-6 font-bold">진행 방식</h3>
                  <span className="text-[13px] leading-[18px] text-[#8b95a1]">
                    {courseExamples
                      ? `총 ${courseExamples.items.length}문장`
                      : "문장 불러오는 중"}
                  </span>
                </div>
                <ol className="divide-y divide-[#e5e8eb] rounded-2xl bg-white px-4">
                  {["현재 문장 녹음", "AI 평가 확인", "다음 문장으로 이동"].map(
                    (label, index) => (
                      <li
                        key={label}
                        className="flex min-h-[57px] items-center gap-3"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-primary text-[13px] font-medium text-primary">
                          {index + 1}
                        </span>
                        <span className="text-[15px] leading-[22px] font-medium text-[#333d4b]">
                          {label}
                        </span>
                      </li>
                    ),
                  )}
                </ol>
              </>
            ) : loading || loadedType !== activeType ? (
              <CourseListSkeleton />
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
                      onClick={() => setExpandedId(String(course.id))}
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
                            {Math.round(progress)}%
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
                          문장별 녹음 · 평가
                        </p>
                      </div>
                    </button>
                  );
                })}
                {items.length === 0 && !error && (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    조건에 맞는 클래스가 없습니다.
                  </p>
                )}
                {loadMoreError && (
                  <p
                    role="alert"
                    className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive"
                  >
                    {loadMoreError}
                  </p>
                )}
                {hasNext && (
                  <button
                    type="button"
                    disabled={loadingMore || refreshing}
                    onClick={() => void loadMore()}
                    className="design-action"
                  >
                    {loadingMore
                      ? "불러오는 중…"
                      : loadMoreError
                        ? "클래스 더 불러오기 재시도"
                        : "클래스 더 보기"}
                  </button>
                )}
              </div>
            )}
          </div>
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

function CourseListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-3 px-5">
      <span className="sr-only">클래스를 불러오는 중</span>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex min-h-[118px] items-start gap-3.5 rounded-2xl bg-white p-[18px]"
        >
          <SkeletonBlock className="size-12 shrink-0 rounded-xl" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-4 w-2/5" />
              <SkeletonBlock className="h-3 w-8" />
            </div>
            <SkeletonBlock className="mt-2 h-3 w-3/5" />
            <SkeletonBlock className="mt-4 h-2 w-full" />
            <SkeletonBlock className="mt-2.5 h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}
