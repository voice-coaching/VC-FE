export const pronunciationCourses = [
  {
    id: "consonant",
    name: "자음 발음 클래스",
    level: "초급",
    description: "또렷한 자음 소리를 익혀요",
    minutes: 16,
    initial: 0,
    sentence: "가까운 공원에서 가볍게 걸어요",
    steps: [
      "자음이 뭉개지는 이유",
      "입 모양으로 배우는 자음 원리",
      "ㄱ ㅋ ㄲ 구분해서 소리 내기",
      "ㄷ ㅌ ㄸ 구분해서 소리 내기",
      "ㅂ ㅍ ㅃ 구분해서 소리 내기",
      "ㅅ ㅆ 구분해서 소리 내기",
      "ㅈ ㅊ ㅉ 구분해서 소리 내기",
      "실전 문장으로 마무리",
    ],
  },
  {
    id: "vowel",
    name: "모음 발음 클래스",
    level: "초급",
    description: "입 모양으로 모음을 구분해요",
    minutes: 12,
    initial: 6,
    sentence: "오후에 우리 모두 모여요",
    steps: [
      "모음 소리 알아보기",
      "입을 열어 소리 내기",
      "아 어 구분하기",
      "오 우 구분하기",
      "이중모음 연습",
      "실전 문장으로 마무리",
    ],
  },
  {
    id: "final",
    name: "받침 발음 클래스",
    level: "중급",
    description: "받침을 또렷하게 발음해요",
    minutes: 24,
    initial: 4,
    sentence: "하늘이 맑고 바람이 시원하다",
    steps: [
      "받침 발음이 뭉개지는 이유",
      "입 모양으로 배우는 받침 원리",
      "받침 ㄱ, ㄷ, ㅂ 소리 내기",
      "받침 ㄴ, ㅁ, ㅇ 소리 내기",
      "받침 ㄹ 소리 내기",
      "겹받침 발음하기",
      "받침 뒤 연음 규칙",
      "문장 속 받침 연습",
      "빠르게 말할 때 받침 유지하기",
      "받침 발음 실전 문장",
      "받침 발음 종합 점검",
      "마무리 테스트",
    ],
  },
  {
    id: "tense",
    name: "된소리 발음 클래스",
    level: "고급",
    description: "된소리를 정확하게 구분해요",
    minutes: 20,
    initial: 0,
    sentence: "깨끗한 그릇에 국수를 담았다",
    steps: [
      "된소리 알아보기",
      "소리의 차이 들어보기",
      "ㄱ과 ㄲ 구분하기",
      "ㄷ과 ㄸ 구분하기",
      "ㅂ과 ㅃ 구분하기",
      "ㅅ과 ㅆ 구분하기",
      "ㅈ과 ㅉ 구분하기",
      "단어 속 된소리 연습",
      "문장 속 된소리 연습",
      "마무리 테스트",
    ],
  },
] as const;

export function completedAfterStep(
  completed: number,
  step: number,
  total: number,
) {
  return Math.min(total, Math.max(completed, step + 1));
}

export const intonationCourses = [
  {
    id: "falling",
    name: "평서문 억양 클래스",
    level: "초급",
    description: "문장 끝을 자연스럽게 내려요",
    minutes: 12,
    initial: 0,
    sentence: "오늘 날씨가 정말 좋네요",
    steps: [
      "문장 끝의 억양 낮추기",
      "문장 끝을 내리는 원리 알아보기",
      "예시 듣고 따라 하기",
      "짧은 문장 억양 연습",
      "긴 문장 억양 연습",
      "실전 문장으로 마무리",
    ],
  },
  {
    id: "rising",
    name: "의문문 억양 클래스",
    level: "중급",
    description: "문장 끝을 올려 물음을 표현해요",
    minutes: 12,
    initial: 6,
    sentence: "오늘 저녁에 같이 걸을까요?",
    steps: [
      "의문문 억양 알아보기",
      "문장 끝을 올리는 원리",
      "예시 듣고 따라 하기",
      "짧은 질문 연습",
      "긴 질문 연습",
      "실전 문장으로 마무리",
    ],
  },
  {
    id: "stress",
    name: "강조 억양 클래스",
    level: "중급",
    description: "핵심 단어를 도드라지게 말해요",
    minutes: 16,
    initial: 0,
    sentence: "오늘은 제가 직접 준비했어요",
    steps: [
      "강조하는 억양 알아보기",
      "핵심 단어 찾기",
      "음높이로 강조하기",
      "길이로 강조하기",
      "예시 듣고 따라 하기",
      "짧은 문장 연습",
      "긴 문장 연습",
      "실전 문장으로 마무리",
    ],
  },
] as const;

export function parseClassProgress(
  value: string | null,
  courses: readonly {
    initial: number;
    steps: readonly string[];
  }[] = pronunciationCourses,
): number[] {
  const defaults = courses.map((course) => Number(course.initial));
  if (!value) return defaults;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return defaults;
    return defaults.map((fallback, index) =>
      Number.isInteger(parsed[index]) &&
      parsed[index] >= 0 &&
      parsed[index] <= courses[index].steps.length
        ? parsed[index]
        : fallback,
    );
  } catch {
    return defaults;
  }
}
