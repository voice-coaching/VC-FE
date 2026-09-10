import type { Metadata } from "next";
import { EmailLoginScreen } from "@/components/email-login-screen";

export const metadata: Metadata = {
  title: "이메일 로그인 · SpeakAI",
};

export default function EmailLoginPage() {
  return <EmailLoginScreen />;
}
