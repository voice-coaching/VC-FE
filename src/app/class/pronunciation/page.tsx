import type { Metadata } from "next";
import PronunciationPage from "@/routes/class/pronunciation";

export const metadata: Metadata = {
  title: "발음 학습하기 | 또박",
  description: "유음화, 받침, 이중모음까지 헷갈리는 발음 규칙을 문장으로 훈련합니다.",
  openGraph: {
    title: "발음 학습하기 | 또박",
    description: "STT가 스크립트와 다른 부분을 정확히 짚어드려요.",
  },
};

export default PronunciationPage;
