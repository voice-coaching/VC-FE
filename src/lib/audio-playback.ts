export function resolveAudioDuration(
  mediaDuration: number,
  fallbackDuration: number,
) {
  if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
    return mediaDuration;
  }
  return Number.isFinite(fallbackDuration) && fallbackDuration > 0
    ? fallbackDuration
    : 0;
}

export function remainingAudioDuration(duration: number, elapsed: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return duration;
  return Math.max(0, duration - elapsed);
}
