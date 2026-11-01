import type { ContentFacetOption, ContentFacets } from "./api/types";

const SENTENCE_CATEGORY_CODES = [
  "FINAL_CONSONANT",
  "TENSE_CONSONANT",
  "CONSONANT",
  "VOWEL",
];

/** Only the backend can supply selectable values and labels; absent codes stay absent. */
export function sentenceCategoryOptions(
  facets: ContentFacets,
): ContentFacetOption[] {
  if (facets.type !== "SENTENCE")
    throw new Error("문장 카테고리 정보를 확인하지 못했어요.");
  return SENTENCE_CATEGORY_CODES.flatMap((code) => {
    const option = facets.categories.find(
      (item) => item.value === code && item.label.trim(),
    );
    return option ? [option] : [];
  });
}

/** null holds a filtered request; undefined means an unfiltered request. */
export function sentenceCategoryRequest(
  selected: string,
  options: readonly ContentFacetOption[],
  ready: boolean,
): string | null | undefined {
  if (selected === "") return undefined;
  if (!ready) return null;
  return options.find((option) => option.value === selected)?.value ?? null;
}
