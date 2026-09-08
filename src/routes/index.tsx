"use client";

import { AppShell } from "@/components/app-shell";
import { LoginMethods } from "@/components/login-methods";

export default function Landing() {
  return (
    <AppShell nav={false}>
      <div className="flex min-h-dvh flex-col justify-between px-6 py-14">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-5xl font-black tracking-tighter">SpeakAI</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            아나운서처럼 또렷하게.
            <br />
            AI가 음절 하나까지 들어드립니다.
          </p>
        </div>

        <LoginMethods />
      </div>
    </AppShell>
  );
}
