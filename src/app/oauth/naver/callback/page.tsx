import { redirect } from "next/navigation";
import { OAuthCallback } from "@/components/oauth-callback";
import {
  createNativeOAuthCallbackUrlFromResponse,
  isNativeOAuthState,
} from "@/lib/native-oauth-callback";

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NaverOAuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const state = first(params.state);
  const nativeReturn = first(params.native_return) === "1";
  if (isNativeOAuthState(state) && !nativeReturn) {
    redirect(
      createNativeOAuthCallbackUrlFromResponse("NAVER", {
        code: first(params.code),
        state,
        error: first(params.error),
        errorDescription: first(params.error_description),
      }),
    );
  }
  return (
    <OAuthCallback
      provider="NAVER"
      code={first(params.code)}
      state={state}
      oauthError={first(params.error)}
      errorDescription={first(params.error_description)}
      nativeReturn={nativeReturn}
    />
  );
}
