import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function Landing() {
  return (
    <AppShell nav={false}>
      <div className="flex min-h-dvh flex-col justify-between px-6 py-14">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-5xl font-black tracking-tighter">또박</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            아나운서처럼 또렷하게.
            <br />
            AI가 음절 하나까지 들어드립니다.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/auth"
            className="w-full rounded-full bg-warning py-4 text-center text-sm font-semibold text-warning-foreground"
          >
            카카오로 시작하기
          </Link>
          <Link
            href="/auth"
            className="w-full rounded-full bg-success py-4 text-center text-sm font-semibold text-success-foreground"
          >
            네이버로 시작하기
          </Link>
          <Link
            href="/auth"
            className="w-full rounded-full bg-foreground py-4 text-center text-sm font-semibold text-background"
          >
            이메일로 회원가입
          </Link>
          <p className="pt-2 text-center text-xs text-muted-foreground">
            이미 계정이 있나요?{" "}
            <Link href="/auth" className="font-semibold text-foreground underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
