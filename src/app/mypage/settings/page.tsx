import { Suspense } from "react";
import AccountSettings from "@/routes/mypage/settings";

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="p-5 text-sm">설정을 불러오는 중…</p>}>
      <AccountSettings />
    </Suspense>
  );
}
