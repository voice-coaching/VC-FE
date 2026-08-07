import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { SENTENCES } from "@/lib/app-data";

export default function PronunciationPage() {
  return (
    <LessonList
      title="발음 학습하기"
      desc="헷갈리는 발음 규칙을 문장으로 익혀요."
      category="pronunciation"
    />
  );
}

export function LessonList({
  title,
  desc,
  category,
}: {
  title: string;
  desc: string;
  category: "pronunciation" | "intonation";
}) {
  const items = SENTENCES.filter((s) => s.category === category);
  return (
    <AppShell>
      <TopBar to="/class" title={title} />
      <div className="px-5 pb-10">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
        <div className="mt-6 flex flex-col gap-3">
          {items.map((s, i) => (
            <Link
              key={s.id}
              href={`/practice/${s.id}`}
              className="rounded-3xl bg-surface p-5 transition-colors hover:bg-muted"
            >
              <p className="text-[11px] text-muted-foreground">
                LESSON {String(i + 1).padStart(2, "0")} · {s.title}
              </p>
              <p className="mt-2 text-[17px] leading-snug font-semibold">{s.script}</p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
