import { getAuthenticatedUserId } from "./auth-session";
import { notifyCoachingUsageChanged } from "./coaching-usage";
import {
  removeUserClientCache,
  removeUserClientCacheGroup,
} from "./client-cache";

export function invalidateLearningCaches() {
  notifyCoachingUsageChanged();
  const userId = getAuthenticatedUserId();
  removeUserClientCacheGroup(userId, "home-");
  removeUserClientCacheGroup(userId, "mypage-history-");
  removeUserClientCacheGroup(userId, "streak-");
  removeUserClientCacheGroup(userId, "course-catalog-");
  removeUserClientCache(userId, "mypage-overview");
}
