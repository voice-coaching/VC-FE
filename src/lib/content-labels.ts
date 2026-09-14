export const CATEGORY_LABELS: Record<string, string> = {
  ECONOMY: "경제",
  SOCIETY: "사회",
  SOCIAL: "사회",
  CULTURE: "문화",
  SPORTS: "스포츠",
  FINAL_CONSONANT: "받침",
  BATCHIM: "받침",
  DOUBLE_CONSONANT: "된소리",
  TENSE_CONSONANT: "된소리",
  CONSONANT: "자음",
  VOWEL: "모음",
};

export function categoryLabel(value: string) {
  return CATEGORY_LABELS[value] ?? value;
}
