import { Suspense } from "react";
import { SettingsRouteSkeleton } from "@/routes/mypage/skeletons";
import AccountSettings from "@/routes/mypage/settings";

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsRouteSkeleton />}>
      <AccountSettings />
    </Suspense>
  );
}
