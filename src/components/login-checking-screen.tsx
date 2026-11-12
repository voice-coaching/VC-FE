/**
 * Shown between the OAuth redirect and home: a flat brand-purple field with
 * the white mark centred, like the launch splash, and three quiet dots near
 * the bottom to say that work is in progress.
 */
export function LoginCheckingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="login-checking relative flex min-h-dvh w-full flex-col items-center justify-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG mark */}
      <img src="/figma/brand/splash-final.svg" alt="" width={70} height={98} />
      <span
        className="login-checking-dots absolute bottom-[max(56px,calc(env(safe-area-inset-bottom)+40px))]"
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">로그인하고 있어요</span>
    </div>
  );
}
