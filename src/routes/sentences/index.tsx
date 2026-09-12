import { ContentCatalog } from "@/components/content-catalog";

export default function SentencesPage() {
  return (
    <ContentCatalog
      type="SENTENCE"
      title="문장 연습"
      description="서버에 등록된 문장으로 발음과 억양을 연습해요."
    />
  );
}
