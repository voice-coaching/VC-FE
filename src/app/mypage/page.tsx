import MyPage from "@/routes/mypage";
import { Suspense } from "react";
import { MyPageRouteSkeleton } from "@/routes/mypage/skeletons";

export default function MyPagePage() {
  return (
    <Suspense fallback={<MyPageRouteSkeleton active="summary" />}>
      <MyPage />
    </Suspense>
  );
}
