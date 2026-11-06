import { notFound } from "next/navigation";
import { LipPracticePreview } from "@/components/lip-practice-preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <LipPracticePreview />;
}
