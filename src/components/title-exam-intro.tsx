"use client";

import { Trophy } from "lucide-react";
import type { PracticeContent, UserTitleExam } from "@/lib/api";
import { splitSentences } from "@/lib/sentences";

/**
 * What the exam is, before anything is recorded: the title you can earn,
 * shown as a medal, and two facts (what you read and the passing line), all from the exam record. Nothing starts until the user taps.
 */
export function TitleExamIntro({
  exam,
  content,
  onStart,
  onLater,
}: {
  exam: UserTitleExam;
  content: PracticeContent;
  onStart: () => void;
  onLater: () => void;
}) {
  const sentences = splitSentences(content.scriptText).length || 1;
  const facts = [
    { label: "읽을 문장", value: `${sentences}문장` },
    { label: "합격 기준", value: `${exam.passingScore}점` },
  ];
  return (
    <div className="title-exam-intro flex min-h-full flex-col">
      <div className="flex flex-1 flex-col items-center px-6 pt-10 pb-6 text-center">
        {/* Medal for the title on offer; the current one sits above, quietly. */}
        <p className="text-[13px] leading-[18px] font-medium text-[#8b95a1]">
          {exam.currentTitle}에서 한 단계 위로
        </p>
        <div className="title-exam-medal mt-5" aria-hidden="true">
          <span className="title-exam-medal-core">
            <Trophy size={40} strokeWidth={1.9} />
          </span>
        </div>
        <span className="title-exam-medal-label mt-4">{exam.targetTitle}</span>
        <h1 className="mt-4 text-[24px] leading-[33px] font-bold tracking-[-0.02em] break-keep text-[#191f28]">
          {exam.targetTitle} 칭호에 도전해요
        </h1>
        <p className="mt-1.5 text-[15px] leading-[23px] break-keep text-[#6b7684]">
          지금까지 연습한 실력을 한 번에 확인해요
        </p>

        <dl className="title-exam-facts mt-8 w-full">
          {facts.map((fact) => (
            <div key={fact.label} className="flex-1">
              <dt className="text-xs leading-4 text-[#8b95a1]">{fact.label}</dt>
              <dd className="mt-1 text-[18px] leading-6 font-bold text-[#191f28] tabular-nums">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 text-[13px] leading-5 break-keep text-[#8b95a1]">
          조용한 곳에서 응시하면 더 정확하게 채점돼요
        </p>
      </div>

      <div className="px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onStart} className="design-action">
          시험 시작하기
        </button>
        <button
          type="button"
          onClick={onLater}
          className="mt-1 min-h-11 w-full text-sm font-medium text-[#8b95a1]"
        >
          다음에 할게요
        </button>
      </div>
    </div>
  );
}
