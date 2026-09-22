import assert from "node:assert/strict";
import test from "node:test";
import { splitSentences } from "./sentences";

test("소수점은 문장 경계로 취급하지 않는다", () => {
  assert.deepEqual(
    splitSentences(
      "한국은행이 기준금리를 연 3.5퍼센트로 동결했습니다. 다음 회의가 열립니다.",
    ),
    [
      "한국은행이 기준금리를 연 3.5퍼센트로 동결했습니다.",
      "다음 회의가 열립니다.",
    ],
  );
});

test("한국어와 영문 문장 부호 및 닫는 따옴표를 보존한다", () => {
  assert.deepEqual(splitSentences("안녕하세요! “잘 들리나요?” 네."), [
    "안녕하세요!",
    "“잘 들리나요?”",
    "네.",
  ]);
});
