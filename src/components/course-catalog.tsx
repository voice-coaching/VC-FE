"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { api, type CourseSummary, type CourseType } from "@/lib/api";

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
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.courses
      .list({ type, status: "PUBLISHED", page: 0, size: 50 })
      .then((result) => active && setItems(result.items))
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
  }, [type]);

  async function start(course: CourseSummary) {
    setStartingId(String(course.id));
    setError(null);
    try {
      await api.courses.start(course.id);
      const steps = await api.courses.getSteps(course.id);
      const practice = steps.find((step) => step.practiceContentId != null);
      if (!practice?.practiceContentId)
        throw new Error("이 클래스의 연습 콘텐츠가 아직 준비되지 않았습니다.");
      router.push(
        `/practice/${practice.practiceContentId}?courseId=${course.id}&courseStepId=${practice.id}`,
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
            {items.map((course) => (
              <button
                key={String(course.id)}
                onClick={() => void start(course)}
                disabled={startingId === String(course.id)}
                className="rounded-3xl bg-surface p-5 text-left transition-colors hover:bg-muted disabled:opacity-50"
              >
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {course.courseType === "PRONUNCIATION" ? "발음" : "억양"} ·{" "}
                    {course.difficulty}
                  </span>
                  <span>{Math.round(course.progressPercent)}%</span>
                </div>
                <p className="mt-2 text-[17px] font-semibold">{course.title}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  약 {course.estimatedMinutes}분 ·{" "}
                  {startingId === String(course.id)
                    ? "시작 중…"
                    : "눌러서 학습 시작"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
