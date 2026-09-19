import type { ApiContract, Id, PracticeContent } from "./api/types";
import { ApiError } from "./api/client";

/** Resolve the displayed example and the analysis transcript from the same DB revision. */
export async function loadPracticeContent(
  api: Pick<ApiContract, "examples" | "content">,
  contentId: Id,
  selection: {
    exampleId: string | null;
    courseId: string | null;
    stepId: string | null;
    revision: string | null;
    sessionId: string | null;
  },
): Promise<PracticeContent> {
  if (!selection.exampleId) return api.content.get(contentId);
  const invalid = () =>
    new ApiError(
      "예문 정보가 변경되었거나 올바르지 않습니다. 코스에서 예문을 다시 선택해 주세요.",
      409,
      "EXAMPLE_CHANGED",
    );
  if (!selection.courseId || !selection.stepId) throw invalid();
  const set = await api.examples.list(
    selection.courseId,
    selection.stepId,
    selection.sessionId ?? undefined,
  );
  if (
    String(set.courseId) !== selection.courseId ||
    String(set.stepId) !== selection.stepId ||
    (selection.revision !== null && String(set.revision) !== selection.revision)
  )
    throw invalid();
  const example = set.items.find((item) => item.id === selection.exampleId);
  if (!example || String(example.practiceContentId) !== String(contentId))
    throw invalid();
  const content = await api.content.get(example.practiceContentId);
  if (
    String(content.id) !== String(example.practiceContentId) ||
    content.scriptText !== example.text
  )
    throw invalid();
  return content;
}
