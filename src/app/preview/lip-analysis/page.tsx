import { notFound } from "next/navigation";
import { PracticeAnalysisLoading } from "@/components/practice-analysis-loading";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto flex h-dvh max-w-[402px] flex-col bg-[linear-gradient(180deg,#f2f4f6_35%,#e1d9ff_100%)]">
      <header className="flex h-12 shrink-0 items-center justify-center text-[17px] font-bold">
        분석 중
      </header>
      <PracticeAnalysisLoading stepProgress={45} />
    </main>
  );
}
