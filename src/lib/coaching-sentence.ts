import type { CoachingItem } from "./coaching";

const endings = new Set([".", "!", "?", "。", "！", "？", "\n", "\r"]);
const closing = new Set(['"', "'", "’", "”", ")", "]", "}"]);
type SentenceRange = {
  text: string;
  start: number;
  end: number;
  number: number;
};

/** Display context only, never a generated AnalysisSegment or sentence grade.
 * Python text anchors count Unicode code points, not UTF-16 code units.
 * Keep whitespace and original offsets; do not search for a repeated word.
 */
export function coachingSentence(
  script: string,
  item: CoachingItem,
): SentenceRange | null {
  const chars = Array.from(script);
  const { charStart, charEnd, syllable, word } = item.location;
  if (
    charStart == null ||
    charEnd == null ||
    !Number.isSafeInteger(charStart) ||
    !Number.isSafeInteger(charEnd) ||
    charStart < 0 ||
    charEnd <= charStart ||
    charEnd > chars.length ||
    !syllable ||
    chars.slice(charStart, charEnd).join("") !== syllable
  )
    return null;
  // The source word is the contiguous Hangul token around the syllable anchor.
  let wordStart = charStart,
    wordEnd = charEnd;
  while (wordStart > 0 && /[가-힣]/u.test(chars[wordStart - 1])) wordStart--;
  while (wordEnd < chars.length && /[가-힣]/u.test(chars[wordEnd])) wordEnd++;
  if (!word || chars.slice(wordStart, wordEnd).join("") !== word) return null;
  const ranges: SentenceRange[] = [];
  const append = (start: number, end: number) => {
    while (start < end && /\s/u.test(chars[start])) start++;
    while (end > start && /\s/u.test(chars[end - 1])) end--;
    if (end > start)
      ranges.push({
        start,
        end,
        text: chars.slice(start, end).join(""),
        number: ranges.length + 1,
      });
  };
  let start = 0;
  for (let index = 0; index < chars.length; index++) {
    if (!endings.has(chars[index])) continue;
    if (
      chars[index] === "." &&
      /\d/u.test(chars[index - 1] ?? "") &&
      /\d/u.test(chars[index + 1] ?? "")
    )
      continue;
    let end = index + 1;
    while (closing.has(chars[end])) end++;
    append(start, end);
    start = end;
    index = end - 1;
  }
  append(start, chars.length);
  return (
    ranges.find((range) => range.start <= charStart && charEnd <= range.end) ??
    null
  );
}
