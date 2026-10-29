import { categoryLabel } from "./content-labels";

// Strip only the catalog's numbered practice prefix, never a genuine headline.
export function newsHeadline(title: string) {
  const cleaned = title
    .replace(/^\s*(?:[가-힣A-Za-z]+\s+)?뉴스\s*연습\s*\d+\s*[-–—:：·]\s*/u, "")
    .trim();
  return cleaned || title.trim();
}

const topics: Array<[string, RegExp]> = [
  ["창업", /창업|스타트업|벤처/u],
  ["봉사", /봉사|기부|나눔/u],
  ["에너지", /에너지|전력|태양광|풍력|발전소|수소|전기요금/u],
  ["환경", /재활용|분리수거|탄소|기후|친환경|환경/u],
  ["관광", /관광|여행/u],
  ["독서", /도서관|독서|출판/u],
  ["지역경제", /상품권|지역화폐|전통시장|소상공인/u],
  ["금융", /금리|은행|금융|대출|환율|증시|주식/u],
  ["부동산", /부동산|주택|아파트|전세/u],
  ["고용", /고용|채용|취업|일자리/u],
  ["교육", /교육|학교|학생|대학/u],
  ["건강", /의료|병원|건강|보건/u],
  ["교통", /교통|지하철|버스|철도/u],
  ["안전", /안전|재난|소방|화재|방재/u],
  ["복지", /복지|돌봄|취약계층|노인|장애인/u],
  ["기술", /인공지능|반도체|디지털|로봇|AI/u],
  ["문화", /공연|전시|축제|영화|음악/u],
  ["스포츠", /축구|야구|농구|올림픽|스포츠/u],
];

// Category and topic are rendered as separate tags, never joined into one string.
export function newsCategoryTags(item: { title: string; category: string }) {
  const category = categoryLabel(item.category).trim();
  const topic = topics.find(([, pattern]) =>
    pattern.test(newsHeadline(item.title)),
  )?.[0];
  if (!category) return { category: topic || "뉴스", topic: null };
  return { category, topic: topic && topic !== category ? topic : null };
}
