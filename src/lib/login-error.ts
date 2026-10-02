import { ApiError } from "./api/client";

export function loginErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError) {
    if (reason.status === 401) {
      return "이메일 또는 비밀번호를 확인해 주세요.";
    }
    if (reason.status === 429) {
      return "로그인 시도가 많아요. 잠시 후 다시 시도해 주세요.";
    }
  }
  return "로그인에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.";
}
