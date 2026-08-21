import type { Metadata } from "next";
import LearningHistoryDetail from "@/routes/mypage/history-detail";

export const metadata: Metadata = {
  title: "학습 기록 상세 | 또박",
  description: "완료한 발음 학습의 녹음과 음절별 분석 결과를 확인하세요.",
};

export default async function LearningHistoryDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <LearningHistoryDetail sessionId={sessionId} />;
}
