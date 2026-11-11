import { Suspense } from "react";
import { MyPageRouteSkeleton } from "@/routes/mypage/skeletons";
import PracticePlan from "@/routes/mypage/plan";

export default function PracticePlanPage() {
  return (
    <Suspense fallback={<MyPageRouteSkeleton active="plan" />}>
      <PracticePlan />
    </Suspense>
  );
}
