export function resolveAudioDuration(
  mediaDuration: number,
  fallbackDuration: number,
) {
  const fallback =
    Number.isFinite(fallbackDuration) && fallbackDuration > 0
      ? fallbackDuration
      : 0;
  if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
    if (fallback >= 1 && mediaDuration < 0.5) return fallback;
    return mediaDuration;
  }
  return fallback;
}

export function remainingAudioDuration(duration: number, elapsed: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return duration;
  return Math.max(0, duration - elapsed);
}
