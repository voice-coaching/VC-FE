import { Suspense } from "react";
import { PaymentsRouteSkeleton } from "@/routes/mypage/skeletons";
import PaymentsPage from "@/routes/mypage/payments";

export default function MyPaymentsPage() {
  return (
    <Suspense fallback={<PaymentsRouteSkeleton />}>
      <PaymentsPage />
    </Suspense>
  );
}
