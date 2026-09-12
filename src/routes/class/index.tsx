import { CourseCatalog } from "@/components/course-catalog";
import PronunciationPrototype from "./prototype";

export default function ClassIndex() {
  if (process.env.NODE_ENV === "development") return <PronunciationPrototype />;
  return (
    <CourseCatalog
      title="클래스"
      description="발음과 억양을 단계별로 훈련해요."
      showBack={false}
    />
  );
}
