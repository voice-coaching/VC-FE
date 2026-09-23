import type { Statistics, StrengthsWeaknesses, UserTitleProgress } from "./api";
import { getAuthenticatedUserId } from "./auth-session";
import { readUserClientCache, updateUserClientCache } from "./client-cache";

const RESOURCE = "mypage-overview";

export type MyPageOverviewCache = {
  nickname?: string;
  statistics?: Statistics;
  feedback?: StrengthsWeaknesses;
  titleProgress?: UserTitleProgress;
};

export function readMyPageOverviewCache() {
  return readUserClientCache<MyPageOverviewCache>(
    getAuthenticatedUserId(),
    RESOURCE,
  );
}

export function updateMyPageOverviewCache(patch: MyPageOverviewCache) {
  updateUserClientCache<MyPageOverviewCache>(
    getAuthenticatedUserId(),
    RESOURCE,
    patch,
  );
}
