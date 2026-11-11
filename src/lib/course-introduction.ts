import type { CourseDetail, CourseSummary } from "./api/types";

// Presentation copy aligned with VC-BE V37/V46 seeds. IDs, examples and progress remain server-owned.
const descriptions: Record<string, string> = {
  "PRONUNCIATION:발음 기초 클래스":
    "기본 모음·자음과 받침을 또렷하게 발음해요.",
  "PRONUNCIATION:발음 연결 클래스":
    "연음·겹받침과 긴 문장을 분명하게 이어 읽어요.",
  "PRONUNCIATION:발음 발표 클래스":
    "전문 용어와 발표 문장을 정확하게 전달해요.",
  "INTONATION:억양 기초 클래스": "문장 끝 억양과 기본 높낮이를 익혀요.",
  "INTONATION:억양 흐름 클래스":
    "의미 단위로 끊어 읽고 억양을 자연스럽게 이어가요.",
  "INTONATION:발표 억양 클래스":
    "강조와 설득이 필요한 발표 문장의 억양을 연습해요.",
};

export function courseIntroduction(
  course: CourseSummary,
  detail?: CourseDetail,
) {
  const text =
    detail?.description?.trim() ||
    descriptions[`${course.courseType}:${course.title}`] ||
    (course.courseType === "INTONATION"
      ? "문장의 높낮이와 끊어 읽기를 문장별로 연습해요."
      : "모음·자음과 받침을 문장별로 또렷하게 연습해요.");
  // The level is shown next to the text, so drop it and use the app's 해요 tone.
  return text
    .replace(/하는 (초급|중급|고급) 클래스입니다\.?$/u, "해요.")
    .replace(/는 (초급|중급|고급) 클래스입니다\.?$/u, "는 클래스예요.")
    .replace(/하는 클래스입니다\.?$/u, "해요.")
    .replace(/합니다\.?$/u, "해요.");
}
