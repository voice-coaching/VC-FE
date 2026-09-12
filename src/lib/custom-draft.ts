export const CUSTOM_DRAFT_KEY = "speakai:custom-draft:v1";
export const CUSTOM_SCRIPT_LIMIT = 300;

export function countScriptCharacters(text: string) {
  return [
    ...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text),
  ].length;
}

export function serializeDraft(text: string) {
  return JSON.stringify({ version: 1, text });
}

export function parseDraft(value: string | null): string | null {
  if (!value) return null;
  try {
    const draft: unknown = JSON.parse(value);
    if (
      typeof draft !== "object" ||
      draft === null ||
      !("version" in draft) ||
      draft.version !== 1 ||
      !("text" in draft) ||
      typeof draft.text !== "string" ||
      !draft.text.trim()
    )
      return null;
    return draft.text;
  } catch {
    return null;
  }
}
