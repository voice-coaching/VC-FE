"use client";

import { useEffect, useState } from "react";
import { BookOpen, X } from "lucide-react";
import {
  api,
  type CourseSummary,
  type CourseStep,
  type PracticeContent,
  type PracticeExample,
  type PracticeExamples,
} from "@/lib/api";
import { TtsPracticePlayer } from "@/components/tts-practice-player";

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
  const [example, setExample] = useState(false);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);
  const [content, setContent] = useState<PracticeContent | null>(null);
  const [examples, setExamples] = useState<PracticeExamples | null>(null);
  const [exampleError, setExampleError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setExamples(null);
    setExampleError(null);
    setSelectedExampleIndex(0);
    api.examples
      .list(course.id, step.id)
      .then((value) => {
        if (active) setExamples(value);
      })
      .catch((reason) => {
        if (active)
          setExampleError(
            reason instanceof Error
              ? reason.message
              : "예문을 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, [course.id, step.id, reload]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setContent(null);
    setError(null);
    if (step.practiceContentId != null)
      api.content
        .get(step.practiceContentId)
        .then((value) => active && setContent(value))
        .catch(
          (reason) =>
            active &&
            setError(
              reason instanceof Error
                ? reason.message
                : "학습 자료를 불러오지 못했습니다.",
            ),
        );
    return () => {
      active = false;
    };
  }, [step.practiceContentId]);
  const declarative =
    course.courseType === "INTONATION" && /평서/.test(course.title);
  const rieul = course.courseType === "PRONUNCIATION" && /ㄹ/.test(step.title);
  const instructions = declarative
    ? [
        "문장 끝 음절에서 소리를 낮춰요",
        "속도를 천천히 줄여요",
        "끝까지 힘을 유지해요",
      ]
    : rieul
      ? [
          "혀끝을 윗잇몸 뒤에 붙여요",
          "혀를 떼면서 소리를 내요",
          "끝까지 힘을 유지해요",
        ]
      : [];
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
              : declarative
                ? "문장 끝에서 소리를 낮춰요"
                : rieul
                  ? "받침 ㄹ, 이렇게 소리 내요"
                  : step.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {example
              ? "문장 속 발음과 억양에 집중해서 들어보세요"
              : (content?.description ?? description)}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
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
            <div className="flex min-h-52 flex-col items-center justify-center rounded-[20px] bg-white p-6 text-primary shadow-sm">
              {declarative ? (
                <svg
                  viewBox="0 0 300 150"
                  role="img"
                  aria-label="문장 끝에서 소리를 낮추는 억양 예시"
                  className="w-full"
                >
                  <path d="M20 90H280" stroke="#d5ddef" strokeDasharray="3 4" />
                  <path
                    d="M20 55L85 51L150 56L215 62L280 114"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  {[
                    [20, 55],
                    [85, 51],
                    [150, 56],
                    [215, 62],
                    [280, 114],
                  ].map(([x, y], index) => (
                    <g key={x}>
                      <circle
                        cx={x}
                        cy={y}
                        r={index === 4 ? 7 : 4}
                        fill={index === 4 ? "currentColor" : "white"}
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <text
                        x={x}
                        y={index === 4 ? 141 : 125}
                        textAnchor="middle"
                        fontSize="13"
                        fill={index === 4 ? "currentColor" : "#8b929a"}
                      >
                        {["정", "말", "좋", "네", "요"][index]}
                      </text>
                    </g>
                  ))}
                </svg>
              ) : rieul ? (
                <svg
                  viewBox="0 0 240 150"
                  role="img"
                  aria-label="혀끝을 윗잇몸 뒤에 붙이는 받침 ㄹ 발음 예시"
                  className="h-36 w-full"
                >
                  <path
                    d="M63 132C61 112 54 87 57 55C60 20 94 12 124 22C143 29 153 44 170 51L189 59Q203 67 187 74L174 77L177 91L169 105L169 130Q116 142 63 132Z"
                    fill="white"
                    stroke="#c7d3ee"
                    strokeWidth="2"
                  />
                  <path
                    d="M75 119Q88 89 117 82Q126 80 128 88Q113 102 87 125Z"
                    fill="#ffb596"
                    stroke="#ef967a"
                  />
                  <path
                    d="M89 81Q116 69 145 83"
                    fill="none"
                    stroke="#9fb4df"
                    strokeWidth="2"
                  />
                  <path
                    d="M81 136L109 88"
                    stroke="#3468ff"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <path d="M105 84L114 87L107 94Z" fill="#3468ff" />
                </svg>
              ) : (
                <BookOpen className="size-16" strokeWidth={1.4} />
              )}
              <p className="mt-3 text-xs">
                {declarative
                  ? "문장 끝 → 소리 낮추기"
                  : rieul
                    ? "혀끝 → 윗잇몸"
                    : "원리를 이해하고 소리 내어 연습해요"}
              </p>
            </div>
            {instructions.length > 0 ? (
              <ol className="design-card divide-y divide-border !py-0">
                {instructions.map((instruction, index) => (
                  <li
                    key={instruction}
                    className="flex gap-3 py-5 text-sm font-semibold"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/5 text-xs text-primary">
                      {index + 1}
                    </span>
                    {instruction}
                  </li>
                ))}
              </ol>
            ) : (
              <section className="design-card">
                <h3 className="mb-3 text-sm font-semibold">학습 안내</h3>
                <p className="text-sm leading-7">
                  {content?.description ??
                    description ??
                    "예시를 듣고 문장을 따라 읽어보세요."}
                </p>
              </section>
            )}
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
