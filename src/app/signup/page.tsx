import type { Metadata } from "next";
import { SignupScreen } from "@/components/signup-screen";

export const metadata: Metadata = {
  title: "회원 가입 · SpeakAI",
};

export default function SignupPage() {
  return <SignupScreen />;
}
