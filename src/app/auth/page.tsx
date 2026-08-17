import type { Metadata } from "next";
import Auth from "@/routes/auth";

export const metadata: Metadata = {
  title: "회원가입 · 로그인 | 또박",
  description: "이메일 또는 SNS 계정으로 또박에 가입하고 발음 훈련을 시작하세요.",
  openGraph: {
    title: "회원가입 · 로그인 | 또박",
    description: "Google 또는 카카오 계정으로 간편하게 시작하세요.",
  },
};

<<<<<<< Updated upstream
export default Auth;
=======
export default function AuthPage() {
  return <Auth />;
}
>>>>>>> Stashed changes
