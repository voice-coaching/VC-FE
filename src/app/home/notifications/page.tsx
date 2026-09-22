import type { Metadata } from "next";
import HomeNotifications from "@/routes/home-notifications";

export const metadata: Metadata = { title: "알림 · SpeakAI" };

export default function HomeNotificationsPage() {
  return <HomeNotifications />;
}
