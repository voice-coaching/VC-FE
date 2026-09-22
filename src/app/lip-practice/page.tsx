import type { Metadata } from "next";
import LipPractice from "@/routes/lip-practice";

export const metadata: Metadata = { title: "입모양 연습 · SpeakAI" };

export default function LipPracticePage() {
  return <LipPractice />;
}
