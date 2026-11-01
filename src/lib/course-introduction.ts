import type { CourseDetail, CourseSummary } from "./api/types";

// Presentation copy aligned with VC-BE V37/V46 seeds. IDs, examples and progress remain server-owned.
const descriptions: Record<string, string> = {
  "PRONUNCIATION:발음 기초 클래스":
    "기본 모음·자음과 받침을 또렷하게 발음하는 초급 클래스입니다.",
  "PRONUNCIATION:발음 연결 클래스":
    "연음·겹받침과 긴 문장의 명료도를 연습하는 중급 클래스입니다.",
  "PRONUNCIATION:발음 발표 클래스":
    "전문 용어와 발표 문장을 정확하게 전달하는 고급 클래스입니다.",
  "INTONATION:억양 기초 클래스":
    "문장 끝 억양과 기본 높낮이를 익히는 초급 클래스입니다.",
  "INTONATION:억양 흐름 클래스":
    "의미 단위별 끊어 읽기와 자연스러운 억양 흐름을 연습합니다.",
  "INTONATION:발표 억양 클래스":
    "강조와 설득이 필요한 발표형 문장의 억양을 연습합니다.",
};

export function courseIntroduction(
  course: CourseSummary,
  detail?: CourseDetail,
) {
  return (
    detail?.description?.trim() ||
    descriptions[`${course.courseType}:${course.title}`] ||
    (course.courseType === "INTONATION"
      ? "문장의 높낮이와 끊어 읽기를 문장별로 연습해요."
      : "모음·자음과 받침을 문장별로 또렷하게 연습해요.")
  );
}
