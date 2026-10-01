export const HOME_HEADER_HEIGHT = 181;
const DIRECTION_THRESHOLD = 12;

export type HeaderScrollState = {
  top: number;
  travel: number;
  hidden: boolean;
};

export function updateHomeHeader(
  previous: HeaderScrollState,
  scrollTop: number,
  maxScroll: number,
): HeaderScrollState {
  // Ignore native rubber-band overscroll at either end of the document.
  const top = Math.max(0, Math.min(scrollTop, Math.max(0, maxScroll)));
  const delta = top - previous.top;
  if (top <= DIRECTION_THRESHOLD) return { top, travel: 0, hidden: false };
  if (delta === 0) return previous;
  const travel =
    Math.sign(delta) === Math.sign(previous.travel)
      ? previous.travel + delta
      : delta;
  if (Math.abs(travel) < DIRECTION_THRESHOLD)
    return { ...previous, top, travel };
  return {
    top,
    travel: 0,
    hidden: travel > 0 && top >= HOME_HEADER_HEIGHT,
  };
}
