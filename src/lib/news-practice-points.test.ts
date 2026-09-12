import test from "node:test";
import assert from "node:assert/strict";
import { newsPracticePoints } from "./news-practice-points";
test("all suggestions occur in the referenced article sentence", () => {
  for (const sentences of [
    ["서울시가 청년 월세 지원 대상을 확대합니다.", "지원금은 월 20만원입니다."],
    ["한국은행이 기준금리를 연 3.5퍼센트로 동결했습니다."],
    ["기온은 27도까지 오릅니다."],
    [],
  ]) {
    for (const group of newsPracticePoints(sentences))
      for (const point of group.items)
        assert.ok(sentences[point.line].includes(point.word));
  }
});
test("decimal and unit stay intact; unrelated sample errors never appear", () => {
  assert.equal(
    newsPracticePoints(["연 3.5퍼센트입니다."])[0].items[0].word,
    "3.5퍼센트",
  );
  assert.ok(
    !JSON.stringify(newsPracticePoints(["오늘은 맑은 날씨입니다."])).includes(
      "퍼센",
    ),
  );
  assert.deepEqual(newsPracticePoints(["", "!!!"]), []);
});
