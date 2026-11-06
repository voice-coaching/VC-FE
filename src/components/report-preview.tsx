"use client";

import { useEffect, useState } from "react";
import { AnalysisView } from "./analysis-view";
import { TopBar } from "./top-bar";
import type { AnalysisResult, AnalysisSegment } from "@/lib/api";

const sentences = [
  "한국은행이 기준금리를 연 3.5퍼센트로 동결했습니다.",
  "이번 결정은 여섯 차례 연속 동결입니다.",
  "물가 상승세가 둔화된 점이 반영됐습니다.",
  "시장은 당분간 관망세를 이어갈 전망입니다.",
  "다음 회의는 다음 달 중순에 열립니다.",
];
const rows = [
  ["모음", 25, 25],
  ["평음", 5, 10],
  ["마찰음", 5, 10],
  ["파찰음", 0, 10],
  ["비음", 7.5, 10],
  ["유음", 3.75, 5],
  ["대본과 음성의 대응", 7.5, 10],
] as const;
const analysis = {
  id: "preview",
  status: "COMPLETED",
  overallScore: 67,
  pronunciationScore: 67,
  strengths: [],
  weaknesses: [],
  summaryFeedback:
    "* 동결 → 끝 받침 ㄹ이 약해져 [동겨]처럼 들렸어요. 혀끝을 윗잇몸에 댄 채로 [결]을 끝까지 울려 주세요.\n* 관망세 → 첫 음절 받침 ㄴ을 살려 주세요. [관]에서 혀끝을 붙인 뒤 [망세]로 이어 말해 보세요.\n* 전망 → [전]을 조금 길게 끌어 ㄴ 소리를 남겨 주세요.",
  scoreBreakdown: {
    items: rows.map(([label, score, maxScore], index) => ({
      criterionId: String(index),
      label,
      score,
      maxScore,
      applicable: true,
      expectedPhones:
        label === "비음" ? ["ㅁ", "ㄴ", "ㅇ"] : label === "유음" ? ["ㄹ"] : [],
      sampleCount: 4,
      description:
        "받침 소리가 약하게 이어져요. 받침을 급하게 닫지 말고 다음 글자로 부드럽게 넘겨 보세요.",
    })),
  },
} as unknown as AnalysisResult;
const segments = sentences.map((text, index) => ({
  id: index + 1,
  sequenceNo: index + 1,
  expectedText: text,
  recognizedText: index === 1 ? "동겨" : index === 3 ? "과망세, 저망" : text,
  startMs: index * 4800,
  endMs: (index + 1) * 4800,
  resultStatus: index === 1 || index === 3 ? "ERROR" : "NORMAL",
  pronunciationScore: index === 2 ? null : index === 1 || index === 3 ? 60 : 95,
  targetUnit: index === 1 ? "동결" : index === 3 ? "관망세" : null,
  feedback:
    index === 1
      ? "끝 받침 ㄹ이 약해져 [동겨]처럼 들렸어요. 혀끝을 윗잇몸에 댄 채로 [결]을 끝까지 울려 주세요."
      : "첫 음절 받침 ㄴ이 빠져 [과망세]로 들렸어요. [관]에서 혀끝을 붙여 ㄴ을 살린 뒤 [망세]로 이어요.",
})) as unknown as AnalysisSegment[];

export function ReportPreview({
  variant = "news",
}: {
  variant?: "news" | "announcer";
}) {
  const announcer = variant === "announcer";
  const displaySentences = announcer
    ? [
        "안녕하십니까, 9월 18일 뉴스를 시작하겠습니다.",
        "오늘 서울 낮 기온은 이십오 도까지 오르겠습니다.",
        "자세한 내용은 잠시 후 전해 드리겠습니다.",
      ]
    : sentences;
  const announcerDetails = {
    "1": [
      {
        word: "시작하겠습니다",
        observed: "시자카게슴니다",
        expected: "시자카겓씀니다",
        feedback:
          "끝 받침 ㅆ이 약해져 [게슴]으로 들렸어요. ‘겓’에서 잠깐 멈췄다가 [씀]으로 힘 있게 이어 주세요.",
        tip: "[겓] 다음에 아주 짧게 멈추면 ㅆ이 또렷해져요. 천천히 세 번 따라 읽어 보세요.",
      },
    ],
    "2": [
      {
        word: "이십오",
        observed: "이시오",
        expected: "이시보",
        feedback:
          "받침 ㅂ이 빠져 [이시오]로 들렸어요. 입술을 붙였다 떼며 [이시보]로 이어 읽어요.",
        tip: "[십]에서 입술을 꼭 붙였다 떼면서 [보]로 넘겨 보세요.",
      },
    ],
  };
  const displaySegments = announcer
    ? (displaySentences.map((text, index) => ({
        ...segments[index],
        id: index + 1,
        sequenceNo: index + 1,
        expectedText: text,
        recognizedText:
          index === 0 ? "시자카게슴니다" : index === 1 ? "이시오" : text,
        resultStatus: index < 2 ? "ERROR" : "NORMAL",
        pronunciationScore: index < 2 ? 60 : 95,
        targetUnit:
          index === 0 ? "시작하겠습니다" : index === 1 ? "이십오" : null,
      })) as AnalysisSegment[])
    : segments;
  const [audio, setAudio] = useState<string>();
  useEffect(() => {
    // Local silent audio enables playback controls without microphone or backend data.
    const bytes = new ArrayBuffer(44 + 8000 * 24 * 2),
      view = new DataView(bytes);
    const word = (offset: number, value: string) =>
      [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    word(0, "RIFF");
    view.setUint32(4, bytes.byteLength - 8, true);
    word(8, "WAVE");
    word(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    word(36, "data");
    view.setUint32(40, bytes.byteLength - 44, true);
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    setAudio(url);
    return () => URL.revokeObjectURL(url);
  }, []);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-[#f2f4f6]">
      <TopBar title="피드백" to={announcer ? "/announcer" : "/news"} />
      <div className="flex items-center justify-center gap-2 px-5 pt-2 text-[13px]">
        <strong className="text-[#6346f6]">
          {announcer ? "아나운서 따라 읽기" : "뉴스 읽기"}
        </strong>
        <span className="h-2.5 w-px bg-[#e5e8eb]" />
        <span className="text-[#8b95a1]">
          {announcer ? "9월 18일 오프닝 멘트" : "한국은행 기준금리 동결"}
        </span>
      </div>
      <AnalysisView
        pronunciationDetails={
          announcer
            ? announcerDetails
            : {
                "2": [
                  {
                    word: "동결",
                    observed: "동겨",
                    expected: "동결",
                    feedback:
                      "끝 받침 ㄹ이 약해져 [동겨]처럼 들렸어요. 혀끝을 윗잇몸에 댄 채로 [결]을 끝까지 울려 주세요.",
                  },
                ],
                "4": [
                  {
                    word: "관망세",
                    observed: "과망세",
                    expected: "관망세",
                    feedback:
                      "첫 음절 받침 ㄴ이 빠져 [과망세]로 들렸어요. [관]에서 혀끝을 붙여 ㄴ을 살린 뒤 [망세]로 이어요.",
                  },
                  {
                    word: "전망",
                    observed: "저망",
                    expected: "전망",
                    feedback:
                      "받침 ㄴ이 약해 [저망]처럼 들렸어요. [전]을 조금 길게 끌어 ㄴ 소리를 남겨 주세요.",
                  },
                ],
              }
        }
        analysis={
          announcer
            ? {
                ...analysis,
                summaryFeedback:
                  "* 시작하겠습니다 → 끝 받침 ㅆ이 약해져 [게슴]으로 들렸어요. ‘겓’에서 잠깐 멈췄다가 [씀]으로 힘 있게 이어 주세요.\n* 이십오 → 받침 ㅂ이 빠져 [이시오]로 들렸어요. 입술을 붙였다 떼며 [이시보]로 이어 읽어요.",
              }
            : analysis
        }
        segments={displaySegments}
        recordingUrl={audio}
        content={{
          id: "preview",
          contentType: announcer ? "ANNOUNCER" : "NEWS",
          title: announcer ? "9월 18일 오프닝 멘트" : "한국은행 기준금리 동결",
          scriptText: displaySentences.join(" "),
          referenceAudioAvailable: false,
        }}
      />
      <div className="bg-white px-5 pt-3 pb-8">
        <a
          href={announcer ? "/announcer" : "/news"}
          className="flex h-14 items-center justify-center rounded-full bg-[#6346f6] text-base font-bold text-white"
        >
          완료하기
        </a>
      </div>
    </main>
  );
}
