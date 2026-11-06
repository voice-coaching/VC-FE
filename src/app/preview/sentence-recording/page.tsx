import { notFound } from "next/navigation";
import { SentenceRecordingPreview } from "@/components/sentence-recording-preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SentenceRecordingPreview />;
}
