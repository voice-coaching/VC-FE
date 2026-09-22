import type { Metadata } from "next";
import HomeStreak from "@/routes/home-streak";

export const metadata: Metadata = { title: "연속 연습 · SpeakAI" };

export default function HomeStreakPage() {
  return <HomeStreak />;
}
