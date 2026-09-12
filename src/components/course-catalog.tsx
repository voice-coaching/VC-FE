"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { IPhoneFrame } from "@/components/iphone-frame";
import { PrototypeBottomNav } from "@/components/prototype-bottom-nav";
import { TopBar } from "@/components/top-bar";
import {
  ApiError,
  api,
  type CourseDetail,
  type CourseProgress,
  type CourseSummary,
  type CourseType,
  type UserCourseProgress,
} from "@/lib/api";

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
  showBack = true,
}: {
  type?: CourseType;
  title: string;
  description: string;
  showBack?: boolean;
}) {
  const router = useRouter();
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
  const [selectedType, setSelectedType] = useState<CourseType>(
    type ?? "PRONUNCIATION",
  );
  const requestType = type ?? (showBack ? undefined : selectedType);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.courses.list({
        type: requestType,
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
  }, [requestType]);

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const result = await api.courses.list({
        type: requestType,
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

  async function start(course: CourseSummary) {
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

      const steps = await api.courses.getSteps(course.id);
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
      const practice =
        remainingSteps.find((step) => step.practiceContentId != null) ??
        steps.find((step) => step.practiceContentId != null);
      if (!practice?.practiceContentId)
        throw new Error("이 클래스의 연습 콘텐츠가 아직 준비되지 않았습니다.");
      router.push(
        `/practice/${practice.practiceContentId}?courseId=${course.id}&courseStepId=${practice.id}&returnTo=${encodeURIComponent(type ? `/class/${type.toLowerCase()}` : "/class")}`,
      );
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
    if (detailsByCourse[key]) return;

    setDetailLoadingId(key);
    setError(null);
    try {
      const detail = await api.courses.get(course.id);
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

  if (!showBack) {
    const visibleItems = items.filter(
      (course) => course.courseType === selectedType,
    );

    return (
      <IPhoneFrame>
        <section className="flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
          <div className="h-11 shrink-0" aria-hidden="true" />
          <header className="flex h-12 shrink-0 items-center justify-center">
            <h1 className="text-[17px] font-bold">{title}</h1>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <p className="mb-4 text-sm text-[#4e5968]">{description}</p>
            <div
              role="tablist"
              aria-label="클래스 종류"
              className="mb-4 grid grid-cols-2 rounded-xl bg-[#f2f4f6] p-1"
            >
              {(["PRONUNCIATION", "INTONATION"] as const).map((courseType) => (
                <button
                  key={courseType}
                  type="button"
                  role="tab"
                  aria-selected={selectedType === courseType}
                  onClick={() => setSelectedType(courseType)}
                  className={`h-10 rounded-[9px] text-sm font-bold transition-colors ${
                    selectedType === courseType
                      ? "bg-white text-[#191f28] shadow-[0_1px_4px_rgba(23,23,23,0.08)]"
                      : "text-[#8b95a1]"
                  }`}
                >
                  {courseType === "PRONUNCIATION"
                    ? "발음 클래스"
                    : "억양 클래스"}
                </button>
              ))}
            </div>

            {error ? (
              <p
                role="alert"
                className="mb-3 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm text-[#d91b34]"
              >
                {error}
              </p>
            ) : null}

            {loading ? (
              <p className="py-12 text-center text-sm text-[#8b95a1]">
                클래스를 불러오는 중…
              </p>
            ) : (
              <div className="space-y-3">
                {visibleItems.map((course) => {
                  const progress = Math.min(
                    100,
                    Math.max(0, course.progressPercent),
                  );
                  const starting = startingId === String(course.id);

                  return (
                    <button
                      key={String(course.id)}
                      type="button"
                      onClick={() => void start(course)}
                      disabled={starting}
                      className="flex w-full gap-3.5 rounded-2xl bg-white p-[18px] text-left shadow-[0_2px_6px_rgba(23,23,23,0.05)] transition-transform active:scale-[0.985] disabled:opacity-60"
                    >
                      <span
                        className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
                          course.courseType === "PRONUNCIATION"
                            ? "bg-[#ccddff]"
                            : "bg-[#e2e9ff]"
                        }`}
                      >
                        <Image
                          src={
                            course.courseType === "PRONUNCIATION"
                              ? "/figma/class/icon.svg"
                              : "/figma/class/stress.svg"
                          }
                          alt=""
                          width={28}
                          height={26}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <strong className="truncate text-[15px]">
                            {course.title}
                          </strong>
                          <span
                            className={`shrink-0 text-xs ${
                              progress > 0 ? "text-[#2f6bff]" : "text-[#8b95a1]"
                            }`}
                          >
                            {starting ? "시작 중…" : `${Math.round(progress)}%`}
                          </span>
                        </span>
                        <span className="mt-1 mb-3 block text-xs text-[#8b95a1]">
                          {course.difficulty} · 약 {course.estimatedMinutes}분
                        </span>
                        <span className="block h-2 overflow-hidden rounded-full bg-[#e5e8eb]">
                          <span
                            className="block h-full rounded-full bg-[#2f6bff]"
                            style={{ width: `${progress}%` }}
                          />
                        </span>
                      </span>
                    </button>
                  );
                })}

                {visibleItems.length === 0 ? (
                  <p className="py-12 text-center text-sm text-[#8b95a1]">
                    조건에 맞는 클래스가 없습니다.
                  </p>
                ) : null}

                {hasNext ? (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                    className="w-full rounded-full border border-[#e5e8eb] py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {loadingMore ? "불러오는 중…" : "클래스 더 보기"}
                  </button>
                ) : null}
              </div>
            )}
          </main>

          <PrototypeBottomNav />
        </section>
      </IPhoneFrame>
    );
  }

  return (
    <AppShell>
      {showBack && <TopBar to="/class" title={title} />}
      <div className={showBack ? "px-5 pb-10" : "px-5 pt-8 pb-10"}>
        <h1 className="text-3xl font-black tracking-tighter">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            클래스를 불러오는 중…
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {items.map((course) => {
              const courseProgress = progressByCourse[String(course.id)];
              const completed =
                courseProgress?.status === "COMPLETED" ||
                course.progressPercent >= 100;

              const key = String(course.id);
              const detail = detailsByCourse[key];

              return (
                <article
                  key={String(course.id)}
                  className="rounded-3xl bg-surface p-5"
                >
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {course.courseType === "PRONUNCIATION" ? "발음" : "억양"}
                      {" · "}
                      {course.difficulty}
                    </span>
                    <span>
                      {completed ? "완료 · " : ""}
                      {Math.round(course.progressPercent)}%
                    </span>
                  </div>
                  <p className="mt-2 text-[17px] font-semibold">
                    {course.title}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    약 {course.estimatedMinutes}분
                  </p>
                  {expandedId === key && (
                    <div className="mt-4 rounded-2xl bg-background p-4 text-xs text-muted-foreground">
                      {detailLoadingId === key ? (
                        <p>상세 정보를 불러오는 중…</p>
                      ) : detail ? (
                        <>
                          <p className="leading-relaxed">
                            {detail.description}
                          </p>
                          <p className="mt-2">
                            전체 {detail.stepCount}단계 · 현재{" "}
                            {Math.round(detail.progress.progressPercent)}%
                          </p>
                        </>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleDetails(course)}
                      disabled={detailLoadingId === key}
                      className="rounded-full border border-border py-2.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {expandedId === key ? "상세 닫기" : "상세 보기"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void start(course)}
                      disabled={startingId === key}
                      className="rounded-full bg-foreground py-2.5 text-xs font-semibold text-background disabled:opacity-50"
                    >
                      {startingId === key
                        ? "시작 중…"
                        : completed
                          ? "다시 학습"
                          : course.progressPercent > 0
                            ? "이어 학습"
                            : "학습 시작"}
                    </button>
                  </div>
                </article>
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
                className="mt-2 rounded-full border border-border py-3 text-sm font-semibold disabled:opacity-50"
              >
                {loadingMore ? "불러오는 중…" : "클래스 더 보기"}
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
