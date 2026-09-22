const SENTENCE_ENDINGS = new Set([".", "!", "?", "。", "！", "？"]);
const CLOSING_MARKS = new Set(['"', "'", "’", "”", ")", "]", "}"]);

export function splitSentences(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return [];

  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (!character || !SENTENCE_ENDINGS.has(character)) continue;

    const previous = text[index - 1];
    const next = text[index + 1];
    if (character === "." && /\d/.test(previous ?? "") && /\d/.test(next ?? ""))
      continue;

    let end = index + 1;
    while (CLOSING_MARKS.has(text[end] ?? "")) end += 1;
    const sentence = text.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
    while (text[start] === " ") start += 1;
    index = start - 1;
  }

  const remainder = text.slice(start).trim();
  if (remainder) sentences.push(remainder);
  return sentences;
}
