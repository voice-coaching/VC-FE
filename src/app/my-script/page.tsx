import { Suspense } from "react";
import { MyScriptScreen } from "@/components/my-script-screen";

export default function MyScriptPage() {
  return (
    <Suspense>
      <MyScriptScreen />
    </Suspense>
  );
}
