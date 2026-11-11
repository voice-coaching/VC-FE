import type { PracticeContent, TrainingHistoryItem } from "./api/types";
import { isTitleExamCategory } from "./catalog-visibility";

export type HistoryContentKind = "custom" | "catalog" | "exam" | "error";

/** The list DTO has no origin/category. Resolve only that metadata, once per content. */
export async function historyContentKinds(
  items: TrainingHistoryItem[],
  getContent: (
    id: TrainingHistoryItem["contentId"],
  ) => Promise<PracticeContent>,
): Promise<Record<string, HistoryContentKind>> {
  const contents = new Map(
    items
      .filter((item) => item.contentType === "SENTENCE")
      .map((item) => [String(item.contentId), item.contentId]),
  );
  const kinds = await Promise.all(
    [...contents].map(async ([key, id]) => {
      try {
        const content = await getContent(id);
        if (String(content.id) !== key)
          throw new Error("Content identity changed");
        const kind: HistoryContentKind = isTitleExamCategory(content.category)
          ? "exam"
          : content.origin === "USER_INPUT"
            ? "custom"
            : "catalog";
        return [key, kind] as const;
      } catch {
        return [key, "error"] as const;
      }
    }),
  );
  return Object.fromEntries(kinds);
}

/** A missing report or failed detail read must never erase a completed history row. */
export function visibleHistoryItems(
  items: TrainingHistoryItem[],
  kinds: Record<string, HistoryContentKind>,
  customOnly: boolean,
) {
  return items.filter(
    (item) =>
      kinds[String(item.contentId)] !== "exam" &&
      (!customOnly || kinds[String(item.contentId)] === "custom"),
  );
}

export function hasDirectHistoryFeedback(
  result: {
    failure: string | null;
    decision: { status: string };
    coaching: {
      feedback?: string;
      items: { expression: { action: string } }[];
    };
  } | null,
) {
  return Boolean(
    result &&
    !result.failure &&
    result.decision.status === "ACCEPT" &&
    (result.coaching.feedback?.trim() ||
      result.coaching.items.some((item) => item.expression.action.trim())),
  );
}
