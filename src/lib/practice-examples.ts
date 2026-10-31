import type {
  ApiContract,
  Id,
  PracticeContent,
  PracticeExamples,
} from "./api/types";
import { ApiError } from "./api/client";
import { orderedCourseExamples } from "./class-practice";

export interface LoadedPracticeSelection {
  content: PracticeContent;
  courseExamples: PracticeExamples | null;
  currentIndex: number | null;
}

/** Resolve the displayed example and the analysis transcript from the same DB revision. */
export async function loadPracticeSelection(
  api: Pick<ApiContract, "examples" | "content">,
  contentId: Id,
  selection: {
    exampleId: string | null;
    courseId: string | null;
    stepId: string | null;
    revision: string | null;
    sessionId: string | null;
  },
): Promise<LoadedPracticeSelection> {
  if (!selection.exampleId)
    return {
      content: await api.content.get(contentId),
      courseExamples: null,
      currentIndex: null,
    };
  const invalid = () =>
    new ApiError(
      "예문 정보가 변경되었거나 올바르지 않습니다. 코스에서 예문을 다시 선택해 주세요.",
      409,
      "EXAMPLE_CHANGED",
    );
  if (!selection.courseId) throw invalid();
  const set = orderedCourseExamples(
    await api.examples.listCourse(
      selection.courseId,
      selection.sessionId ?? undefined,
    ),
    selection.courseId,
  );
  if (
    String(set.courseId) !== selection.courseId ||
    (selection.stepId !== null && String(set.stepId) !== selection.stepId) ||
    (selection.revision !== null && String(set.revision) !== selection.revision)
  )
    throw invalid();
  const currentIndex = set.items.findIndex(
    (item) => item.id === selection.exampleId,
  );
  const example = set.items[currentIndex];
  if (!example || String(example.practiceContentId) !== String(contentId))
    throw invalid();
  const content = await api.content.get(example.practiceContentId);
  if (
    String(content.id) !== String(example.practiceContentId) ||
    content.scriptText !== example.text
  )
    throw invalid();
  return { content, courseExamples: set, currentIndex };
}

export async function loadPracticeContent(
  api: Pick<ApiContract, "examples" | "content">,
  contentId: Id,
  selection: Parameters<typeof loadPracticeSelection>[2],
): Promise<PracticeContent> {
  return (await loadPracticeSelection(api, contentId, selection)).content;
}
