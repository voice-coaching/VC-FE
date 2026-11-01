import { ApiError } from "./api/client";
import type { CoachingUsage } from "./api/types";

export const COACHING_SCRIPT_LIMIT = 300;
export const COACHING_AUDIO_LIMIT_MS = 90_000;
export const COACHING_USAGE_CHANGED = "speakai:coaching-usage-changed";

export function notifyCoachingUsageChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(COACHING_USAGE_CHANGED));
}

export function readCoachingUsage(value: unknown): CoachingUsage {
  const data = value as CoachingUsage | null;
  const count = (value: unknown) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const date = (value: unknown) =>
    typeof value === "string" && Number.isFinite(Date.parse(value));
  if (
    !data ||
    !["free", "paid", "admin"].includes(data.membershipType) ||
    typeof data.unlimited !== "boolean" ||
    typeof data.canRequestCoaching !== "boolean" ||
    !count(data.used) ||
    !count(data.reserved) ||
    (data.membershipType === "admin"
      ? !(
          data.unlimited &&
          data.environment === "TEST" &&
          data.limit === null &&
          data.remaining === null &&
          data.startsAt === null &&
          data.expiresAt === null &&
          data.used === 0 &&
          data.reserved === 0 &&
          data.canRequestCoaching
        )
      : data.unlimited ||
        data.environment !== (data.membershipType === "paid" ? "TEST" : null) ||
        !count(data.limit) ||
        data.limit === 0 ||
        !count(data.remaining) ||
        data.remaining! > data.limit! ||
        !date(data.startsAt) ||
        !date(data.expiresAt) ||
        Date.parse(data.startsAt!) >= Date.parse(data.expiresAt!) ||
        (data.canRequestCoaching && data.remaining === 0))
  )
    throw new ApiError(
      "코칭 사용량을 확인하지 못했어요. 다시 확인해 주세요.",
      502,
      "COACHING_USAGE_INVALID",
    );
  return data;
}

export function coachingPeriodDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function coachingLimitNotice(reason: unknown) {
  if (!(reason instanceof ApiError)) return null;
  const messages = {
    COACHING_QUOTA_EXCEEDED: {
      kind: "quota",
      title: "이용기간의 코칭 횟수를 모두 사용했어요",
      hint: "분석 중인 예약도 한도에 포함돼요. 사용량과 이용권을 확인해 주세요. 기존 결과는 계속 볼 수 있어요.",
    },
    COACHING_PERIOD_EXPIRED: {
      kind: "period",
      title: "무료 코칭 체험 기간이 끝났어요",
      hint: "무료 코칭 체험은 계정당 최초 한 달만 제공돼요. 기존 결과는 계속 볼 수 있으며, 코칭을 계속하려면 이용권을 확인해 주세요.",
    },
    COACHING_SCRIPT_LIMIT_EXCEEDED: {
      kind: "script",
      title: "분석 원고는 300자 이내여야 해요",
      hint: "공백과 문장부호를 포함한 기준이에요. 원고를 줄이거나 다른 문장을 선택해 주세요.",
    },
    COACHING_AUDIO_LIMIT_EXCEEDED: {
      kind: "audio",
      title: "분석 음성은 90초 이내여야 해요",
      hint: "음성이 비어 있거나 길이 제한을 초과했어요. 90초 이내로 다시 녹음해 주세요.",
    },
  } as const;
  return messages[reason.code as keyof typeof messages] ?? null;
}

export function assertCoachingInput(script: string, durationMs: number) {
  if (!script.trim() || Array.from(script).length > COACHING_SCRIPT_LIMIT)
    throw new ApiError(
      "공백과 문장부호를 포함해 원고를 300자 이내로 맞춰 주세요.",
      422,
      "COACHING_SCRIPT_LIMIT_EXCEEDED",
    );
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    durationMs > COACHING_AUDIO_LIMIT_MS
  )
    throw new ApiError(
      "음성은 90초 이내로 녹음해 주세요.",
      422,
      "COACHING_AUDIO_LIMIT_EXCEEDED",
    );
}
