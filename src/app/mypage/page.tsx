import MyPage from "@/routes/mypage";
import { Suspense } from "react";

export default function MyPagePage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-5">
          마이페이지를 불러오는 중…
        </p>
      }
    >
      <MyPage />
    </Suspense>
  );
}
