import { notFound } from "next/navigation";
import { LoginCheckingScreen } from "@/components/login-checking-screen";

/** Dev-only: the screen shown while an OAuth sign-in is being confirmed. */
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto max-w-[402px]">
      <LoginCheckingScreen />
    </main>
  );
}
