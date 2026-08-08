import { CourseCatalog } from "@/components/course-catalog";

export default function ClassIndex() {
  return (
    <CourseCatalog
      title="클래스"
      description="발음과 억양을 단계별로 훈련해요."
      showBack={false}
    />
  );
}
