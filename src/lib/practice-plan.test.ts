import assert from "node:assert/strict";
import test from "node:test";
import {
  initialPlan,
  parsePracticePlan,
  selectedPlanOptions,
} from "./practice-plan";

test("old plans retain their choices and gain the missing focus field", () => {
  const old = {
    goal: "면접, 발표 준비",
    schedule: "매일",
    method: "뉴스 읽기",
  };
  assert.deepEqual(parsePracticePlan(JSON.stringify(old)), {
    ...old,
    focus: initialPlan.focus,
  });
});

test("four-field plans round-trip without losing custom text", () => {
  const plan = {
    ...initialPlan,
    focus: "전달력",
    method: "내가 작성한 연습 방식",
  };
  assert.deepEqual(parsePracticePlan(JSON.stringify(plan)), plan);
});

test("missing or malformed storage falls back safely", () => {
  for (const raw of [null, "bad json", "null", "[]"]) {
    assert.deepEqual(parsePracticePlan(raw), initialPlan);
  }
  assert.equal(
    parsePracticePlan('{"goal":3,"method":" "}').goal,
    initialPlan.goal,
  );
});

test("single-choice goals retain commas while multi-choice fields split", () => {
  assert.deepEqual(selectedPlanOptions("goal", "면접, 발표 준비"), [
    "면접, 발표 준비",
  ]);
  assert.deepEqual(selectedPlanOptions("focus", "빠른 말하기, 말 습관"), [
    "빠른 말하기",
    "말 습관",
  ]);
  assert.deepEqual(selectedPlanOptions("method", "짧은 문장 반복, 내 원고"), [
    "짧은 문장 반복",
    "내 원고",
  ]);
});
