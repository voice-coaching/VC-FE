import type { Metadata } from "next";
import { Suspense } from "react";
import Practice from "@/routes/practice/$id";

export const metadata: Metadata = {
  title: "문장 연습 · 음절별 피드백 | 또박",
  description:
    "아나운서 음성을 따라 읽고 STT 결과와 음절별 발음 점수를 확인하세요.",
  openGraph: {
    title: "문장 연습 · 음절별 피드백 | 또박",
    description: "스크립트와 다른 부분을 AI가 정확히 짚어줍니다.",
  },
};

export default async function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <Practice contentId={id} />
    </Suspense>
  );
}
