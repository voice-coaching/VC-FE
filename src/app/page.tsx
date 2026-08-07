import type { Metadata } from "next";
import Landing from "@/routes/index";

export const metadata: Metadata = {
  title: "또박 · AI 발음 · 억양 트레이닝",
  description:
    "아나운서 문장을 따라 읽고 AI가 음절별 발음과 억양을 채점해주는 한국어 스피치 트레이닝 앱.",
  openGraph: {
    title: "또박 · AI 발음 · 억양 트레이닝",
    description: "매일 3분, 뉴스 스크립트로 또렷한 말하기를 연습하세요.",
  },
};

export default Landing;
