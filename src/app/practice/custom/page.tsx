import type { Metadata } from "next";
import CustomPractice from "@/routes/practice/custom";

export const metadata: Metadata = {
  title: "내 문장 연습 (BM) | 또박",
  description: "발표문, 면접 답변 등 내 문장을 붙여넣고 음절별 발음 피드백을 받아보세요.",
  openGraph: {
    title: "내 문장 연습 (BM) | 또박",
    description: "원하는 문장 그대로 아나운서 음성과 AI 채점을 이용하세요.",
  },
};

export default CustomPractice;
