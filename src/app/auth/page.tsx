import type { Metadata } from "next";
import { Suspense } from "react";
import Auth from "@/routes/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "로그인 | SpeakAI",
  description: "SNS 계정으로 SpeakAI에 로그인하고 발음 훈련을 시작하세요.",
  openGraph: {
    title: "로그인 | SpeakAI",
    description: "네이버, 카카오 또는 구글 계정으로 간편하게 시작하세요.",
  },
};

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <Auth />
    </Suspense>
  );
}
