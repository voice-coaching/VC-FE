import { OAuthCallback } from "@/components/oauth-callback";

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function KakaoOAuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <OAuthCallback
      provider="KAKAO"
      code={first(params.code)}
      state={first(params.state)}
      oauthError={first(params.error ?? params.error_reason)}
      errorDescription={first(params.error_description)}
    />
  );
}
