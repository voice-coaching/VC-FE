"use client";

import { useState } from "react";
import { TitleExamIntro } from "@/components/title-exam-intro";
import { TitleExamResultCard } from "@/components/title-exam-session";
import type { PracticeContent, UserTitleExam } from "@/lib/api";

const EXAM: UserTitleExam = {
  id: 1,
  currentTitle: "초보",
  targetTitle: "동네 아나운서",
  practiceContentId: 1,
  requiredTrainingCount: 10,
  passingScore: 75,
  status: "READY",
  trainingSessionId: null,
  createdAt: new Date().toISOString(),
} as UserTitleExam;

const CONTENT = {
  id: 1,
  contentType: "SENTENCE",
  title: "승급 시험 문장",
  scriptText:
    "정책 변화가 지역 산업에 미치는 영향을 분석했습니다. 새로운 기준을 적용해 결과를 다시 검토했습니다. 핵심 내용을 단계별로 설명하겠습니다.",
} as PracticeContent;

/** Dev-only: title exam intro and both result states with sample data. */
export function TitleExamPreview() {
  const [view, setView] = useState<"intro" | "pass" | "fail">("intro");
  return (
    <main className="mx-auto min-h-dvh max-w-[402px] bg-white">
      <div className="flex gap-1.5 px-5 pt-3">
        {(["intro", "pass", "fail"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`rounded-[6px] px-2.5 py-1.5 text-xs font-medium ${view === key ? "bg-[#191f28] text-white" : "bg-[#f2f4f6] text-[#4e5968]"}`}
          >
            {{ intro: "안내", pass: "합격", fail: "불합격" }[key]}
          </button>
        ))}
      </div>
      {view === "intro" ? (
        <TitleExamIntro
          exam={EXAM}
          content={CONTENT}
          onStart={() => setView("pass")}
          onLater={() => undefined}
        />
      ) : (
        <div className="px-5 py-5">
          <TitleExamResultCard
            key={view}
            result={
              view === "pass"
                ? {
                    examId: 1,
                    status: "PASSED",
                    score: 82.4,
                    passingScore: 75,
                    passed: true,
                    previousTitle: "초보",
                    currentTitle: "동네 아나운서",
                    evaluatedAt: new Date().toISOString(),
                  }
                : {
                    examId: 1,
                    status: "FAILED",
                    score: 68.6,
                    passingScore: 75,
                    passed: false,
                    previousTitle: "초보",
                    currentTitle: "초보",
                    evaluatedAt: new Date().toISOString(),
                  }
            }
          />
        </div>
      )}
    </main>
  );
}
