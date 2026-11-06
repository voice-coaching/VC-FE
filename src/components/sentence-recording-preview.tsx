"use client";
import { TopBar } from "./top-bar";
import { NewsRecordingPreview } from "./news-recording-preview";
import type { PracticeContent } from "@/lib/api";
const content: PracticeContent = {
  id: "preview",
  contentType: "SENTENCE",
  title: "문장 연습",
  category: "FINAL_CONSONANT",
  difficulty: "BEGINNER",
  estimatedSeconds: 10,
  scriptText: "맑은 하늘 아래 낚싯대를 드리웠다",
  description: null,
  learningFocus: "PRONUNCIATION",
  targetPronunciations: ["맑"],
  referenceAudioAvailable: false,
  origin: null,
  sentences: null,
  createdAt: null,
};
export function SentenceRecordingPreview({
  announcer = false,
}: {
  announcer?: boolean;
}) {
  const previewContent: PracticeContent = announcer
    ? {
        ...content,
        contentType: "ANNOUNCER",
        title: "아나운서 따라 읽기",
        scriptText:
          "시청자 여러분 안녕하십니까. 구월 이일 아침 뉴스입니다.\n오늘 첫 소식은 한국은행의 기준금리 결정입니다.\n자세한 내용 취재기자 연결해 알아보겠습니다.",
      }
    : content;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col overflow-hidden bg-[#f2f4f6] [--primary:#6346f6]">
      <TopBar title="연습하기" to="/sentences" />
      <div className="flex flex-1 flex-col [&>div]:flex-1">
        <NewsRecordingPreview
          content={previewContent}
          initiallyRecording={announcer}
        />
      </div>
    </main>
  );
}
