import type { ContentType } from "./api/types";
import { categoryLabel } from "./content-labels";

/** Display labels and legacy names must not become the sentence API's category value. */
export function contentCategoryCode(
  type: ContentType | undefined,
  category: string | undefined,
) {
  if (type === "SENTENCE" && category && categoryLabel(category) === "된소리")
    return "tense";
  return category;
}

export function contentFilterCodes<
  T extends { type?: ContentType; category?: string },
>(filters: T): T {
  return {
    ...filters,
    category: contentCategoryCode(filters.type, filters.category),
  };
}
