import type { ApiContract } from "./api/types";

export async function weaknessPracticeHref(api: Pick<ApiContract, "myPage">) {
  const result = await api.myPage.getWeaknessRecommendations({
    contentType: "SENTENCE",
    limit: 1,
  });
  const content = result.recommendations.find(
    (item) => item.targetType === "CONTENT" && item.contentId != null,
  );
  if (!content) return "/class/pronunciation";
  const params = new URLSearchParams({ returnTo: "/mypage" });
  return `/practice/${encodeURIComponent(String(content.contentId))}?${params}`;
}
