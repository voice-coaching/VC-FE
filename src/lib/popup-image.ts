import { z } from "zod";

export const popupImageSchema = z.object({
  id: z.string().uuid(),
  url: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:"),
  expiresAt: z.string().datetime({ offset: true }),
});
export type PopupImage = z.infer<typeof popupImageSchema>;
