export const DEFAULT_SCRIPT_TOPICS = ["발표", "면접", "자기소개", "미분류"];
export type ScriptTopics = {
  topics: string[];
  assignments: Record<string, string>;
};

export function readScriptTopics(key: string): ScriptTopics {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      Array.isArray(value?.topics) &&
      value.topics.every((item: unknown) => typeof item === "string")
    ) {
      const topics = [
        ...new Set([...DEFAULT_SCRIPT_TOPICS, ...value.topics]),
      ] as string[];
      const assignments = Object.fromEntries(
        Object.entries(value.assignments ?? {}).filter(
          ([, topic]) => typeof topic === "string" && topics.includes(topic),
        ),
      );
      return { topics, assignments: assignments as Record<string, string> };
    }
  } catch {
    /* Missing or unavailable browser storage uses the initial topics. */
  }
  return { topics: [...DEFAULT_SCRIPT_TOPICS], assignments: {} };
}
