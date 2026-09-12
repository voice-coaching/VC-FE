import type { Metadata } from "next";
import { TermsScreen } from "@/components/terms-screen";

export const metadata: Metadata = {
  title: "약관 동의 · SpeakAI",
};

export default function TermsPage() {
  return <TermsScreen />;
}
