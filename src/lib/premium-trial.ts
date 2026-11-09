import { z } from "zod";
import { ApiError, createHttpClient } from "./api/client";

const date = z.string().datetime({ offset: true });
const trialSchema = z
  .discriminatedUnion("status", [
    z.object({
      status: z.literal("ELIGIBLE"),
      eligible: z.literal(true),
      startsAt: z.null(),
      expiresAt: z.null(),
    }),
    z.object({
      status: z.literal("INELIGIBLE"),
      eligible: z.literal(false),
      startsAt: z.null(),
      expiresAt: z.null(),
    }),
    z.object({
      status: z.literal("ACTIVE"),
      eligible: z.literal(false),
      startsAt: date,
      expiresAt: date,
    }),
    z.object({
      status: z.literal("EXPIRED"),
      eligible: z.literal(false),
      startsAt: date,
      expiresAt: date,
    }),
  ])
  .refine(
    (value) =>
      !value.startsAt ||
      Date.parse(value.expiresAt!) - Date.parse(value.startsAt) ===
        72 * 60 * 60 * 1000,
  );

export type PremiumTrialStatus = z.infer<typeof trialSchema>;
const { request } = createHttpClient("/api/backend");

export async function loadPremiumTrial(
  signal?: AbortSignal,
): Promise<PremiumTrialStatus> {
  return trialSchema.parse(
    await request<unknown>("/api/users/me/premium-trial", {
      method: "GET",
      cache: "no-store",
      signal,
      endpointErrorsOnly: true,
    }),
  );
}

export async function activatePremiumTrial(
  signal?: AbortSignal,
): Promise<PremiumTrialStatus> {
  const status = trialSchema.parse(
    await request<unknown>("/api/users/me/premium-trial", {
      method: "POST",
      cache: "no-store",
      signal,
      endpointErrorsOnly: true,
    }),
  );
  if (status.status !== "ACTIVE")
    throw new ApiError(
      "체험 시작 상태를 확인하지 못했어요. 다시 시도해 주세요.",
      502,
      "PREMIUM_TRIAL_NOT_ACTIVE",
    );
  return status;
}
