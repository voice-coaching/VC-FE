import { ApiError } from "./api/client";

export async function requestDeveloperSession(): Promise<never> {
  throw new ApiError(
    "예문과 연습 데이터는 서버에서 불러옵니다. 실제 계정으로 로그인해 주세요.",
    401,
    "REAL_ACCOUNT_REQUIRED",
  );
}
