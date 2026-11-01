import type { PopularNews } from "./api/types";

export function popularNewsPayload(value: unknown): PopularNews {
  const data = value as PopularNews | null;
  if (
    !data ||
    data.type !== "NEWS" ||
    !["CATALOG_ORDER", "COMPLETED_USERS"].includes(data.rankingBasis) ||
    ![
      data.periodStart,
      data.periodEnd,
      data.generatedAt,
      data.nextUpdateAt,
    ].every(
      (date) => typeof date === "string" && Number.isFinite(Date.parse(date)),
    ) ||
    Date.parse(data.periodStart) >= Date.parse(data.periodEnd) ||
    Date.parse(data.periodEnd) >= Date.parse(data.nextUpdateAt) ||
    !Array.isArray(data.items) ||
    data.items.length > 10 ||
    data.items.some(
      (item, index) =>
        !item ||
        item.rank !== index + 1 ||
        item.contentType !== "NEWS" ||
        !/^[1-9]\d*$/.test(String(item.id)) ||
        typeof item.title !== "string" ||
        !item.title.trim() ||
        !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(item.difficulty) ||
        !Number.isSafeInteger(item.usageCount) ||
        item.usageCount < 0 ||
        !Number.isFinite(item.estimatedSeconds) ||
        item.estimatedSeconds < 0,
    ) ||
    new Set(data.items.map((item) => String(item.id))).size !==
      data.items.length
  )
    throw new Error("인기 뉴스 목록을 확인하지 못했어요. 다시 시도해 주세요.");
  return data;
}

export function popularNewsSubtitle(
  data: PopularNews | null,
  error: string | null,
) {
  if (error && data)
    return "이전 집계 순위예요. 아래 버튼으로 다시 갱신해 주세요.";
  if (!data) return "하루에 한 번 갱신되는 인기 뉴스를 확인해 보세요.";
  return data.rankingBasis === "CATALOG_ORDER"
    ? "집계 전 뉴스 목록 순서 · 매일 00:00 갱신"
    : "전날 연습 완료 사용자 기준 · 매일 00:00 갱신";
}
