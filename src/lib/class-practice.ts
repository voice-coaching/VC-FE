import { ApiError } from "./api/client";
import type { Id, PracticeExamples } from "./api/types";

const unavailableMessage =
  "이 클래스의 연습 문장이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.";

export function orderedCourseExamples(
  value: PracticeExamples,
  expectedCourseId?: Id,
): PracticeExamples {
  if (
    expectedCourseId != null &&
    String(value.courseId) !== String(expectedCourseId)
  )
    throw new ApiError(
      "클래스 예문 정보가 변경되었습니다. 클래스를 다시 열어 주세요.",
      409,
      "EXAMPLE_CHANGED",
    );

  const items = [...value.items].sort((a, b) => a.order - b.order);
  if (items.length === 0)
    throw new ApiError(
      unavailableMessage,
      503,
      "PRACTICE_EXAMPLES_UNAVAILABLE",
    );

  return { ...value, items };
}

export function classPracticeHref(
  value: PracticeExamples,
  index: number,
  returnTo: string,
) {
  const item = value.items[index];
  if (!item)
    throw new ApiError(
      "다음 연습 문장을 찾을 수 없습니다.",
      409,
      "EXAMPLE_CHANGED",
    );

  const params = new URLSearchParams({
    courseId: String(value.courseId),
    courseStepId: String(value.stepId),
    returnTo,
    exampleId: item.id,
    exampleRevision: String(value.revision),
  });
  return `/practice/${encodeURIComponent(String(item.practiceContentId))}?${params.toString()}`;
}

export function classExamplesErrorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    if (reason.status === 404)
      return "접근할 수 없는 클래스이거나 클래스 정보를 찾을 수 없습니다.";
    if (reason.status === 503) return unavailableMessage;
  }
  return reason instanceof Error
    ? reason.message
    : "클래스 연습 문장을 불러오지 못했습니다.";
}
