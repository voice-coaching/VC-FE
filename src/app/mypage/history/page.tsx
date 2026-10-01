import { Suspense } from "react";
import LearningHistory from "@/routes/mypage/history";

export default function LearningHistoryPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-5">
          학습 기록을 불러오는 중…
        </p>
      }
    >
      <LearningHistory />
    </Suspense>
  );
}
