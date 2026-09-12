export const HISTORY_KEY = "speakai:prototype-history:v1";
export const HISTORY_EVENT = "prototype-history-changed";
export type PracticeCompletion = {
  id: string;
  mode: "news" | "announcer" | "sentence" | "custom" | "class";
  title: string;
  sentenceCount: number;
  completedAt: string;
  daily: boolean;
};
export const modeLabels = {
  news: "뉴스 읽기",
  announcer: "따라 읽기",
  sentence: "문장 연습",
  custom: "내 문장",
  class: "클래스",
};
export function localDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function parseHistory(raw: string | null): PracticeCompletion[] {
  try {
    const items: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(items)) return [];
    return items
      .filter(
        (item): item is PracticeCompletion =>
          item &&
          typeof item.id === "string" &&
          Object.hasOwn(modeLabels, item.mode) &&
          typeof item.title === "string" &&
          item.title.length <= 200 &&
          Number.isInteger(item.sentenceCount) &&
          item.sentenceCount > 0 &&
          item.sentenceCount <= 300 &&
          typeof item.completedAt === "string" &&
          Number.isFinite(Date.parse(item.completedAt)) &&
          typeof item.daily === "boolean",
      )
      .slice(0, 100)
      .map((item) =>
        item.mode === "class"
          ? { ...item, title: item.title.replace(/\s*·\s*/g, " ") }
          : item,
      );
  } catch {
    return [];
  }
}
export function addCompletion(
  items: PracticeCompletion[],
  item: PracticeCompletion,
) {
  return items.some((entry) => entry.id === item.id)
    ? items
    : [item, ...items].slice(0, 100);
}
export function todaySummary(items: PracticeCompletion[], now = new Date()) {
  const today = items.filter(
    (item) => localDay(new Date(item.completedAt)) === localDay(now),
  );
  return {
    count: today.length,
    sentences: today.reduce((sum, item) => sum + item.sentenceCount, 0),
    dailyDone: today.some((item) => item.daily),
  };
}
