import type { Metadata } from "next";
import Home from "@/routes/home";

export const metadata: Metadata = {
  title: "홈 · 오늘의 훈련 | 또박",
  description: "온보딩 목표에 맞춰 오늘 해야 할 발음·억양 훈련을 우선순위로 보여줍니다.",
  openGraph: {
    title: "홈 · 오늘의 훈련 | 또박",
    description: "오늘의 뉴스 읽기부터 내 문장 연습까지 한 화면에서.",
  },
};

export default Home;
