import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createRemoteApi } from "../src/lib/api/remote";
import { saveOnboardingPlan } from "../src/lib/save-onboarding-plan";
import { SCHEDULE_OPTIONS } from "../src/lib/onboarding-options";
import type { OnboardingSaveInput } from "../src/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const input: OnboardingSaveInput = {
  currentLevel: "INTERMEDIATE",
  dailyGoalMinutes: 10,
  goalText: "presentation",
  weeklyGoalCount: null,
  surveyAnswers: {
    learningPurposes: ["INTERVIEW"],
    improvementAreas: ["pronunciation"],
    pronunciationConcerns: ["vowels"],
    learningSituations: ["news"],
  },
};
const json = (data: unknown) =>
  Response.json({ result: true, message: "ok", data });

test("fixed goal can be cleared, reloaded, reselected, and changed back without losing answers", async () => {
  let stored = { ...input, weeklyGoalCount: 7 as number | null };
  const methods: string[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "/api/backend/api/onboarding/me");
    const method = init?.method ?? "GET";
    methods.push(method);
    if (method === "GET")
      return json({ ...stored, completedAt: "2026-10-03T00:00:00Z" });
    const body = JSON.parse(String(init?.body));
    if (method === "PUT") {
      assert.deepEqual(body.surveyAnswers, input.surveyAnswers);
      assert.equal(body.currentLevel, "INTERMEDIATE");
      stored = body;
    } else {
      if (body.weeklyGoalCount != null)
        stored.weeklyGoalCount = body.weeklyGoalCount;
    }
    return json({ completed: true });
  };
  const api = createRemoteApi("/api/backend");
  const flexible = SCHEDULE_OPTIONS.find(
    (option) => option.value === "flexible",
  )!;
  assert.equal(flexible.weeklySessions, null);
  for (const count of [flexible.weeklySessions, null, 5]) {
    const result = await saveOnboardingPlan(api, {
      ...input,
      weeklyGoalCount: count,
    });
    assert.equal(result.weeklyGoalCount, count);
  }
  assert.deepEqual(methods, ["PUT", "GET", "PUT", "GET", "PATCH", "GET"]);
});

test("server retaining the old goal is reported as failure instead of optimistic success", async () => {
  globalThis.fetch = async (_url, init) =>
    json(
      init?.method === "PUT"
        ? { completed: true }
        : { ...input, weeklyGoalCount: 3 },
    );
  await assert.rejects(
    saveOnboardingPlan(createRemoteApi("/api/backend"), input),
    /주간 목표가 저장되지/,
  );
});
