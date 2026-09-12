import { ContentCatalog } from "@/components/content-catalog";

export default function NewsPage() {
  return (
    <ContentCatalog
      type="NEWS"
      title="뉴스 읽기"
      description="서버에 등록된 뉴스 원고를 읽고 발음과 억양을 분석해요."
    />
  );
}
