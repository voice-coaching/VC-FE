import type {
  ContentFacets,
  ContentType,
  PracticeContentSummary,
} from "./api/types";

export const TITLE_EXAM_CONTENT_CATEGORY = "TITLE_EXAM";

function isTitleExamCategory(value: string, label?: string) {
  return (
    value === TITLE_EXAM_CONTENT_CATEGORY ||
    value === "EXAMPLE_QUESTION" ||
    value === "승급시험" ||
    label === "승급시험" ||
    value === "예시문제" ||
    label === "예시문제"
  );
}

/** Exam questions stay addressable by their pinned exam URL, but never appear in practice discovery. */
export function catalogItemsForPractice(
  type: ContentType,
  items: PracticeContentSummary[],
) {
  if (type !== "SENTENCE") return items;
  return items.filter((item) => !isTitleExamCategory(item.category));
}

export function catalogFacetsForPractice(
  type: ContentType,
  facets: ContentFacets,
) {
  if (type !== "SENTENCE") return facets;
  return {
    ...facets,
    categories: facets.categories.filter(
      (option) => !isTitleExamCategory(option.value, option.label),
    ),
  };
}
