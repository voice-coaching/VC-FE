import { z } from "zod";
import { getAuthSessionVersion } from "@/lib/api/client";
import { popupImageSchema } from "@/lib/popup-image";
import { adminApi } from "./api";
import type { Popup } from "./types";

const receipt = z.object({
  id: z.number().int().positive(),
  version: z.number().int().nonnegative(),
  image: popupImageSchema.nullable(),
});
function fields(current: Popup, reason: string) {
  return z
    .object({
      version: z.number().int().nonnegative(),
      reason: z.string().trim().min(1, "작업 사유를 입력해 주세요.").max(500),
    })
    .parse({ version: current.version, reason });
}
export function validatePopupImage(file: File) {
  if (
    !["image/png", "image/jpeg"].includes(file.type) ||
    file.size < 1 ||
    file.size > 3 * 1024 * 1024
  )
    throw new Error("PNG 또는 JPEG 이미지를 3MB 이하로 첨부해 주세요.");
}
export async function uploadPopupImage(
  current: Popup,
  file: File,
  reason: string,
) {
  validatePopupImage(file);
  const input = fields(current, reason),
    form = new FormData();
  form.set("version", String(input.version));
  form.set("reason", input.reason);
  form.set("file", file);
  const session = getAuthSessionVersion();
  const result = receipt.parse(
    await adminApi.create(`/popups/${current.id}/image`, form),
  );
  if (
    session !== getAuthSessionVersion() ||
    result.id !== current.id ||
    result.version <= current.version ||
    !result.image
  )
    throw new Error(
      "이미지 저장 결과를 확인하지 못했습니다. 팝업을 다시 조회해 주세요.",
    );
  return result;
}
export async function removePopupImage(current: Popup, reason: string) {
  const session = getAuthSessionVersion();
  const result = receipt.parse(
    await adminApi.remove(
      `/popups/${current.id}/image`,
      fields(current, reason),
    ),
  );
  if (
    session !== getAuthSessionVersion() ||
    result.id !== current.id ||
    result.version <= current.version ||
    result.image !== null
  )
    throw new Error(
      "이미지 해제 결과를 확인하지 못했습니다. 팝업을 다시 조회해 주세요.",
    );
  return result;
}
