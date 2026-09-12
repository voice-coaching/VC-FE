import { CourseCatalog } from "@/components/course-catalog";
import PronunciationPrototype from "./prototype";

export default function PronunciationPage() {
  if (process.env.NODE_ENV === "development") return <PronunciationPrototype />;
  return (
    <CourseCatalog
      type="PRONUNCIATION"
      title="발음 학습하기"
      description="헷갈리는 발음 원리를 단계별로 익혀요."
    />
  );
}
