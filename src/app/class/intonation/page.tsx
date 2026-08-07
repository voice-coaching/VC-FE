import type { Metadata } from "next";
import IntonationPage from "@/routes/class/intonation";

export const metadata: Metadata = {
  title: "억양 학습하기 | 또박",
  description: "문장 끝 억양과 강조 억양을 아나운서 음성과 비교하며 훈련합니다.",
  openGraph: {
    title: "억양 학습하기 | 또박",
    description: "단조로운 말투를 리듬 있는 전달로 바꿔보세요.",
  },
};

export default IntonationPage;
