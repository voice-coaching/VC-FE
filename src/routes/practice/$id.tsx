import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { PracticeSession } from "@/components/practice-session";
import type { PracticeSentence } from "@/lib/app-data";

export default function Practice({ sentence }: { sentence: PracticeSentence }) {
  const back =
    sentence.category === "pronunciation"
      ? "/class/pronunciation"
      : sentence.category === "intonation"
        ? "/class/intonation"
        : "/home";

  return (
    <AppShell nav={false}>
      <TopBar to={back} progress={40} />
      <PracticeSession sentence={sentence} />
    </AppShell>
  );
}
