import { CourseCatalog } from "@/components/course-catalog";
import PronunciationPrototype from "./prototype";

export default function IntonationPage() {
  if (process.env.NODE_ENV === "development")
    return <PronunciationPrototype key="intonation" mode="intonation" />;
  return (
    <CourseCatalog
      type="INTONATION"
      title="억양 학습하기"
      description="문장의 리듬과 끝맺음을 단계별로 다듬어요."
    />
  );
}
