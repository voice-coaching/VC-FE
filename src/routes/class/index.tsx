import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SENTENCES } from "@/lib/app-data";

export default function ClassIndex() {
  return (
    <AppShell>
      <div className="px-5 pt-8 pb-10">
        <h1 className="text-3xl font-black tracking-tighter">클래스</h1>
        <p className="mt-2 text-sm text-muted-foreground">두 축으로 나눠 차근차근 훈련해요.</p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/class/pronunciation"
            className="flex h-40 flex-col justify-end rounded-3xl bg-surface p-5 transition-colors hover:bg-muted"
          >
            <span className="text-[11px] text-muted-foreground">CHAPTER 01</span>
            <span className="text-xl font-bold">발음 학습하기</span>
          </Link>
          <Link
            href="/class/intonation"
            className="flex h-40 flex-col justify-end rounded-3xl bg-surface p-5 transition-colors hover:bg-muted"
          >
            <span className="text-[11px] text-muted-foreground">CHAPTER 02</span>
            <span className="text-xl font-bold">억양 학습하기</span>
          </Link>
        </div>

        <p className="mt-8 mb-3 text-xs font-semibold text-muted-foreground">오늘의 뉴스</p>
        <div className="flex flex-col gap-2">
          {SENTENCES.filter((s) => s.category === "news").map((s) => (
            <Link
              key={s.id}
              href={`/practice/${s.id}`}
              className="rounded-2xl border border-border px-5 py-4 transition-colors hover:bg-surface"
            >
              <p className="text-[15px] font-semibold">{s.script}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{s.announcer}</p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
