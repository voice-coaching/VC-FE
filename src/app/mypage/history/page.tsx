import { Suspense } from "react";
import { HistoryRouteSkeleton } from "@/routes/mypage/skeletons";
import LearningHistory from "@/routes/mypage/history";

export default function LearningHistoryPage() {
  return (
    <Suspense fallback={<HistoryRouteSkeleton />}>
      <LearningHistory />
    </Suspense>
  );
}
