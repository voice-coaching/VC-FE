import { z } from "zod";
import { createHttpClient } from "./api/client";

const activePopupSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().trim().min(1).max(200),
    body: z
      .string()
      .min(1)
      .max(1000)
      .refine((value) => value.trim().length > 0),
    deepLink: z.enum(["/home", "/notifications", "/mypage"]).nullable(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
  })
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt));

export type ActiveHomePopup = {
  id: number;
  title: string;
  body: string;
  href: "/home" | "/home/notifications" | "/mypage" | null;
};
const { request } = createHttpClient("/api/backend");

/** The server selects the current popup by its own clock and priority. Never cache it as home content. */
export async function loadActiveHomePopup(
  signal?: AbortSignal,
): Promise<ActiveHomePopup | null> {
  const data = await request<unknown>("/api/users/me/popup", {
    method: "GET",
    cache: "no-store",
    signal,
    endpointErrorsOnly: true,
  });
  const popup = activePopupSchema.nullable().parse(data);
  return popup
    ? {
        id: popup.id,
        title: popup.title,
        body: popup.body,
        href:
          popup.deepLink === "/notifications"
            ? "/home/notifications"
            : popup.deepLink,
      }
    : null;
}
