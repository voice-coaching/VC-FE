import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteApi } from "./api/remote";
import { weaknessPracticeHref } from "./weakness-practice";

test("weakness practice opens the backend-recommended sentence with a return path", async () => {
  const api = createRemoteApi("/api/backend");
  api.myPage.getWeaknessRecommendations = async (filters) => {
    assert.deepEqual(filters, { contentType: "SENTENCE", limit: 1 });
    return {
      weaknesses: [],
      recommendations: [
        {
          targetType: "CONTENT",
          contentId: 42,
          contentType: "SENTENCE",
          title: "받침 연습",
          reason: "받침 복습",
        },
      ],
    };
  };
  assert.equal(
    await weaknessPracticeHref(api),
    "/practice/42?returnTo=%2Fmypage",
  );
});

test("without recommendation data, weakness practice opens the pronunciation classes", async () => {
  const api = createRemoteApi("/api/backend");
  api.myPage.getWeaknessRecommendations = async () => ({
    weaknesses: [],
    recommendations: [],
  });
  assert.equal(await weaknessPracticeHref(api), "/class/pronunciation");
});

test("recommendation failures propagate so the page can offer retry", async () => {
  const api = createRemoteApi("/api/backend");
  api.myPage.getWeaknessRecommendations = async () => {
    throw new Error("일시적 오류");
  };
  await assert.rejects(weaknessPracticeHref(api), /일시적 오류/);
});
