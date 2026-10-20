import type { ShareAnchor } from "../store/tabShares";

const GAP = 6;
const MARGIN = 8;
// Below its anchor unless that leaves less than this; then it moves up.
const MIN_ROOM = 320;

export interface PopoverPlace {
  left: number;
  top: number;
  maxHeight: number;
}

// Where the share popover goes: under its anchor, its right edge on a button's
// (its left edge on a menu's point), inside the window, and scrolling inside
// when it's taller than the room it has.
export function placeSharePopover(
  anchor: ShareAnchor,
  width: number,
  viewport: { width: number; height: number },
): PopoverPlace {
  const point = anchor.right - anchor.left < 1;
  const preferred = point ? anchor.left : anchor.right - width;
  const left = Math.max(MARGIN, Math.min(preferred, viewport.width - width - MARGIN));
  const top = Math.max(MARGIN, Math.min(anchor.bottom + GAP, viewport.height - MIN_ROOM - MARGIN));
  return { left, top, maxHeight: viewport.height - top - MARGIN };
}
