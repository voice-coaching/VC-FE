import { Suspense } from "react";
import PaymentsPage from "@/routes/mypage/payments";

export default function MyPaymentsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-5">
          결제 정보를 불러오는 중…
        </p>
      }
    >
      <PaymentsPage />
    </Suspense>
  );
}
