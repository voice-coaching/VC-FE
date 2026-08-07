export type Goal = "presentation" | "interview" | "broadcast" | "daily" | "meeting";

export type Level = "beginner" | "intermediate" | "advanced";

export interface OnboardingProfile {
  name: string;
  goals: Goal[];
  level: Level;
  minutesPerDay: number;
  weakness: string;
}

export interface SyllableFeedback {
  text: string;
  score: number; // 0-100
  note?: string;
  status?: "correct" | "warning" | "needs_improvement" | "missing" | "added";
  errorType?: "consonant" | "vowel" | "final_consonant" | "fortis" | "intonation";
  startMs?: number;
  endMs?: number;
}

export interface PracticeSentence {
  id: string;
  script: string;
  category: "news" | "pronunciation" | "intonation" | "custom";
  title: string;
  announcer: string;
  /** simulated STT result of the learner's recording */
  recognized: string;
  syllables: SyllableFeedback[];
}

export const GOAL_LABELS: Record<Goal, string> = {
  presentation: "발표·프레젠테이션",
  interview: "면접 준비",
  broadcast: "아나운싱·방송",
  daily: "일상 대화 또렷하게",
  meeting: "회의·업무 커뮤니케이션",
};

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "이제 막 시작했어요",
  intermediate: "기본은 되지만 아쉬워요",
  advanced: "디테일을 다듬고 싶어요",
};

function syllablesOf(script: string, scores: number[], notes: Record<number, string> = {}) {
  const chars = script.split("");
  let i = -1;
  return chars.map((text) => {
    if (text.trim() === "") return { text, score: 100 };
    i += 1;
    return {
      text,
      score: scores[i % scores.length],
      note: notes[i],
    };
  });
}

export const SENTENCES: PracticeSentence[] = [
  {
    id: "news-1",
    category: "news",
    title: "오늘의 뉴스 스크립트",
    announcer: "김서연 아나운서",
    script: "정부는 오늘 물가 안정을 위한 추가 대책을 발표했습니다.",
    recognized: "정부는 오늘 물까 안정을 위한 추가 대책을 발표했습니다",
    syllables: syllablesOf(
      "정부는 오늘 물가 안정을 위한 추가 대책을 발표했습니다.",
      [92, 88, 74, 96, 91, 58, 63, 89, 94, 77, 95, 86, 71, 93],
      { 7: "된소리로 발음됐어요. '물가'의 '가'는 여린 소리로." },
    ),
  },
  {
    id: "news-2",
    category: "news",
    title: "오늘의 뉴스 스크립트",
    announcer: "박준호 아나운서",
    script: "내일 전국에 걸쳐 강한 바람과 함께 비 소식이 있겠습니다.",
    recognized: "내일 전국에 걸처 강한 바람과 함께 비 소시기 있겠습니다",
    syllables: syllablesOf(
      "내일 전국에 걸쳐 강한 바람과 함께 비 소식이 있겠습니다.",
      [95, 82, 69, 90, 88, 61, 92, 84, 96, 73, 87, 91],
      { 6: "'쳐'가 '처'로 뭉개졌어요. 입술을 앞으로 모아보세요." },
    ),
  },
  {
    id: "pron-1",
    category: "pronunciation",
    title: "받침 ㄹ·ㄴ 구분",
    announcer: "이하늘 아나운서",
    script: "신라면을 끓이며 난로 앞에서 신라 이야기를 나눴다.",
    recognized: "신나면을 끄리며 난노 앞에서 신라 이야기를 나눳다",
    syllables: syllablesOf(
      "신라면을 끓이며 난로 앞에서 신라 이야기를 나눴다.",
      [78, 54, 90, 88, 66, 92, 85, 59, 94, 90, 81, 76],
      { 1: "'신라'는 [실라]로 유음화돼요." },
    ),
  },
  {
    id: "pron-2",
    category: "pronunciation",
    title: "장단음과 모음 구분",
    announcer: "김서연 아나운서",
    script: "외과 의사가 회의 자료를 위원회에 제출했다.",
    recognized: "왜과 이사가 훼이 자료를 위원회에 제출했다",
    syllables: syllablesOf(
      "외과 의사가 회의 자료를 위원회에 제출했다.",
      [62, 88, 57, 91, 84, 70, 93, 86, 79, 95],
      { 0: "'외'는 [웨]에 가깝게, 입술을 둥글게 유지하세요." },
    ),
  },
  {
    id: "into-1",
    category: "intonation",
    title: "문장 끝 억양 내리기",
    announcer: "박준호 아나운서",
    script: "이번 주말에는 가족과 함께 시간을 보내려고 합니다.",
    recognized: "이번 주말에는 가족과 함께 시간을 보내려고 합니다",
    syllables: syllablesOf(
      "이번 주말에는 가족과 함께 시간을 보내려고 합니다.",
      [90, 93, 88, 72, 95, 91, 68, 89, 92, 64, 87, 90],
      { 9: "끝을 올려 읽었어요. 서술문은 낮게 마무리하세요." },
    ),
  },
  {
    id: "into-2",
    category: "intonation",
    title: "강조 억양 살리기",
    announcer: "이하늘 아나운서",
    script: "가장 중요한 것은 속도가 아니라 방향입니다.",
    recognized: "가장 중요한 거슨 속도가 아니라 방향입니다",
    syllables: syllablesOf(
      "가장 중요한 것은 속도가 아니라 방향입니다.",
      [88, 92, 60, 94, 85, 90, 66, 93, 87, 91],
      { 2: "'중요한'에 강세를 주면 문장이 또렷해져요." },
    ),
  },
];

export const NEWS_TODAY = SENTENCES.filter((s) => s.category === "news");

export function scoreColor(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-destructive";
}

export function scoreBg(score: number) {
  if (score >= 85) return "bg-success/15";
  if (score >= 70) return "bg-warning/25";
  return "bg-destructive/15";
}

export interface TrainingRecord {
  date: string;
  label: string;
  score: number;
  minutes: number;
}

export const TRAINING_RECORDS: TrainingRecord[] = [
  { date: "07.27", label: "오늘의 뉴스 읽기", score: 86, minutes: 8 },
  { date: "07.26", label: "발음 학습 · 받침 ㄹ/ㄴ", score: 79, minutes: 12 },
  { date: "07.25", label: "억양 학습 · 문장 끝", score: 83, minutes: 6 },
  { date: "07.24", label: "내 문장 연습", score: 74, minutes: 15 },
  { date: "07.23", label: "오늘의 뉴스 읽기", score: 81, minutes: 9 },
];

export const AI_STRENGTHS = [
  "문장 첫 어절의 발화가 또렷하고 안정적이에요.",
  "속도 조절이 일정해서 듣기 편안한 리듬을 만듭니다.",
];

export const AI_WEAKNESSES = [
  "유음화(신라 → 실라) 규칙에서 자주 놓쳐요.",
  "서술문 끝 억양이 올라가는 습관이 있어요.",
  "'외/의' 이중모음이 단모음으로 뭉개집니다.",
];
