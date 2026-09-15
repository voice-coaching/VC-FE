import type { Goal } from "./app-data";

export type ScheduleId = "daily" | "weekdays" | "relaxed" | "flexible";
export type EditSection = "purpose" | "improvements" | "schedule" | "methods";

export type DetailedOption<T extends string> = {
  value: T;
  title: string;
  description: string;
  icon?: string;
  iconClassName?: string;
};

export const PURPOSE_OPTIONS = [
  {
    value: "broadcast",
    title: "아나운서, 방송 준비",
    description: "정확한 발음과 자연스러운 낭독 연습",
    icon: "/figma/onboarding/broadcast.svg",
    iconClassName: "h-[35px] w-[15px]",
  },
  {
    value: "interview",
    title: "면접, 발표 준비",
    description: "또렷한 전달력과 자신감 키우기",
    icon: "/figma/onboarding/interview.svg",
    iconClassName: "size-[27px] -scale-x-100",
  },
  {
    value: "presentation",
    title: "발음을 더 또렷하게",
    description: "어려운 자음과 모음 집중 연습",
    icon: "/figma/onboarding/pronunciation.svg",
    iconClassName: "h-[25px] w-[31px]",
  },
  {
    value: "daily",
    title: "일상에서 자연스럽게 말하기",
    description: "부담 없이 꾸준히 말하기 연습",
    icon: "/figma/onboarding/daily.svg",
    iconClassName: "h-[25px] w-[33px]",
  },
] satisfies Array<DetailedOption<Goal>>;

export const IMPROVEMENT_OPTIONS = [
  { value: "발음이 자주 뭉개져요", summary: "발음" },
  { value: "억양이 단조롭게 들려요", summary: "억양" },
  { value: "말이 자꾸 빨라져요", summary: "빠른 말하기" },
  { value: "말할 때 목소리가 떨려요", summary: "목소리 떨림" },
  { value: "발표할 때 전달이 어려워요", summary: "전달력" },
  {
    value: "소리를 듣기 어려워서 의사소통이 불편해요",
    summary: "청취 어려움",
  },
  { value: "“음…”, “어…”를 자주 말해요", summary: "말 습관" },
] as const;

export const SCHEDULE_OPTIONS = [
  {
    value: "daily",
    title: "매일",
    description: "하루 3~5분 추천",
    weeklySessions: 7,
  },
  {
    value: "weekdays",
    title: "주 5일",
    description: "평일 중심으로 연습",
    weeklySessions: 5,
  },
  {
    value: "relaxed",
    title: "주 2~3일",
    description: "여유 있는 날에 연습",
    weeklySessions: 3,
  },
  {
    value: "flexible",
    title: "자유롭게 시작할래요",
    description: "정해진 일정 없이 시작",
    weeklySessions: 3,
  },
] satisfies Array<DetailedOption<ScheduleId> & { weeklySessions: number }>;

export const METHOD_OPTIONS = [
  {
    value: "뉴스 읽기",
    title: "뉴스 읽기",
    summary: "뉴스 읽기",
    description: "오늘의 기사로 또박또박 낭독",
  },
  {
    value: "아나운서 따라 읽기",
    title: "아나운서 따라 읽기",
    summary: "따라 읽기",
    description: "기준 음성을 듣고 그대로 따라 읽기",
  },
  {
    value: "짧은 문장 반복하기",
    title: "짧은 문장 반복하기",
    summary: "짧은 문장 반복",
    description: "어려운 발음만 골라 반복 연습",
  },
  {
    value: "내 원고로 연습하기",
    title: "내 원고로 연습하기",
    summary: "내 원고",
    description: "면접 답변, 발표 원고 붙여넣기",
  },
] as const;
