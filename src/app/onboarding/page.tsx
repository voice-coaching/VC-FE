import type { Metadata } from "next";
import Onboarding from "@/routes/onboarding";

export const metadata: Metadata = {
  title: "온보딩 설문 | 또박",
  description: "목표와 수준을 알려주면 또박이 맞춤 학습 순서를 만들어 드려요.",
  openGraph: {
    title: "온보딩 설문 | 또박",
    description: "4가지 질문으로 나만의 발음 훈련 커리큘럼을 설계합니다.",
  },
};

export default Onboarding;
