import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "마이페이지 · AI 리포트 | 또박",
  description: "AI가 분석한 내 발음 강점과 약점, 훈련 기록과 목표를 한눈에 확인하세요.",
  openGraph: {
    title: "마이페이지 · AI 리포트 | 또박",
    description: "매일의 훈련이 어떻게 쌓이는지 확인해 보세요.",
  },
};

export default function MyPageLayout({ children }: { children: ReactNode }) {
  return children;
}
