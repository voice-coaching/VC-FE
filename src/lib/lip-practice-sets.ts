import { LIP_PRACTICE_PROMPTS } from "./lip-practice";
export type LipPracticeSet = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  sentences: readonly string[];
};
export const LIP_PRACTICE_SETS: LipPracticeSet[] = [
  {
    id: "basic",
    title: "기본 발음",
    description: "입을 크게 벌리는 짧은 문장부터 시작해요",
    minutes: 2,
    sentences: LIP_PRACTICE_PROMPTS,
  },
  {
    id: "news",
    title: "뉴스 문장",
    description: "아나운서처럼 또박또박 끊어 읽어요",
    minutes: 2,
    sentences: [
      "한국은행이 기준금리를 연 3.5퍼센트로 동결했습니다.",
      "이번 결정은 여섯 차례 연속 동결입니다.",
      "시장은 당분간 관망세를 이어갈 전망입니다.",
    ],
  },
  {
    id: "final",
    title: "받침 집중",
    description: "ㄹ, ㅁ, ㅇ 받침에서 입모양을 다듬어요",
    minutes: 3,
    sentences: [
      "오늘 아침 맑은 하늘을 바라봅니다.",
      "작은 공을 손으로 꼭 잡아 봅니다.",
      "마음에 담은 말을 천천히 전합니다.",
      "따뜻한 봄바람이 창문으로 들어옵니다.",
      "밝은 표정으로 마지막 말을 마칩니다.",
    ],
  },
];
