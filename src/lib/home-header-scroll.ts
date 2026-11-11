export const HOME_HEADER_HEIGHT = 187;

export type HeaderScrollState = {
  top: number;
  /** How far the header is pushed up, 0 (fully shown) to HOME_HEADER_HEIGHT. */
  offset: number;
};

/**
 * The header follows the finger: it scrolls away 1:1 with the content, and on
 * the way back it slides in only as far as the user scrolls up.
 */
export function updateHomeHeader(
  previous: HeaderScrollState,
  scrollTop: number,
  maxScroll: number,
): HeaderScrollState {
  // Ignore native rubber-band overscroll at either end of the document.
  const top = Math.max(0, Math.min(scrollTop, Math.max(0, maxScroll)));
  const delta = top - previous.top;
  const offset = Math.min(
    Math.max(previous.offset + delta, 0),
    HOME_HEADER_HEIGHT,
    // Near the top the header rides with the content and is never detached.
    top,
  );
  return { top, offset };
}

/** Where a half-revealed header should settle once scrolling stops. */
export function settleHomeHeader(state: HeaderScrollState) {
  const { offset, top } = state;
  if (offset <= 0 || offset >= HOME_HEADER_HEIGHT) return offset;
  // Still attached to the content near the top; nothing to resolve.
  if (offset >= top) return offset;
  return offset > HOME_HEADER_HEIGHT / 2 ? HOME_HEADER_HEIGHT : 0;
}
