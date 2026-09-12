/** Text-based practice suggestions, never claims about recognized speech. */
export function newsPracticePoints(sentences: string[]) {
  const numbers: { word: string; line: number }[] = [];
  const words: { word: string; line: number }[] = [];
  sentences.forEach((sentence, line) => {
    const number = sentence.match(
      /\d+(?:[.,]\d+)*(?:퍼센트|개월|만원|월|일|년|명|도|배|원|%|만|천)?/u,
    )?.[0];
    if (number) numbers.push({ word: number, line });
    const word = (sentence.match(/[가-힣]{2,}/gu) ?? []).sort(
      (a, b) => b.length - a.length,
    )[0];
    if (word) words.push({ word, line });
  });
  return [
    { title: "숫자 읽기", items: numbers },
    { title: "또렷하게 읽을 표현", items: words },
  ].filter((group) => group.items.length > 0);
}
