import assert from "node:assert/strict";
import test from "node:test";
import { newsHeadline, newsCategoryTags } from "./news-presentation";

test("removes numbered practice labels without altering genuine news headlines", () => {
  assert.equal(newsHeadline("경제 뉴스 연습 6 - 창업 상담"), "창업 상담");
  assert.equal(newsHeadline("사회 뉴스 연습 7 – 청년 봉사단"), "청년 봉사단");
  assert.equal(newsHeadline("경제 뉴스 연습 6 - "), "경제 뉴스 연습 6 -");
  assert.equal(
    newsHeadline("경제 성장률 6% - 전망과 과제"),
    "경제 성장률 6% - 전망과 과제",
  );
});

test("classifies headline topics and preserves the server's filter category", () => {
  for (const [title, category, expected] of [
    ["경제 뉴스 연습 6 - 창업 상담", "ECONOMY", ["경제", "창업"]],
    ["사회 뉴스 연습 7 - 청년 봉사단", "SOCIETY", ["사회", "봉사"]],
    ["사회 뉴스 연습 3 - 재활용 교육", "SOCIETY", ["사회", "환경"]],
    ["경제 뉴스 연습 9 - 지역 관광 연계", "ECONOMY", ["경제", "관광"]],
    ["사회 뉴스 연습 1 - 도서관 프로그램", "SOCIETY", ["사회", "독서"]],
    ["경제 뉴스 연습 2 - 지역 상품권", "ECONOMY", ["경제", "지역경제"]],
    ["에너지 효율 투자", "ECONOMY", ["경제", "에너지"]],
    ["친환경 포장", "ECONOMY", ["경제", "환경"]],
    ["디지털 전환 지원", "ECONOMY", ["경제", "기술"]],
    ["소상공인 교육", "ECONOMY", ["경제", "지역경제"]],
    ["새로운 소식", "SOCIETY", ["사회", null]],
    ["새로운 소식", "", ["뉴스", null]],
  ] as const)
    assert.deepEqual(newsCategoryTags({ title, category }), {
      category: expected[0],
      topic: expected[1],
    });
});
