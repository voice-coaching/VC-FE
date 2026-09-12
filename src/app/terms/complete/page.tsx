import type { Metadata } from "next";
import { SignupCompleteScreen } from "@/components/signup-complete-screen";

export const metadata: Metadata = {
  title: "가입 완료 · SpeakAI",
};

export default function TermsCompletePage() {
  return <SignupCompleteScreen />;
}
