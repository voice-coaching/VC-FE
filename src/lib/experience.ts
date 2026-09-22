import type { ContentType } from "@/lib/api";

/** Local product experiences that intentionally do not extend the server API. */
export type ExperienceKind = ContentType | "LIP_PRACTICE";

export type ScreenDataState =
  "loading" | "ready" | "empty" | "unavailable" | "error";
