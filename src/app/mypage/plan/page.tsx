import { Suspense } from "react";
import PracticePlan from "@/routes/mypage/plan";

export default function PracticePlanPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-5">
          연습 계획을 불러오는 중…
        </p>
      }
    >
      <PracticePlan />
    </Suspense>
  );
}
