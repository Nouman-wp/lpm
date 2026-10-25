const GAP = 8;
const MARGIN = 8;

/** Where a panel of `width` × `height` floats beside a sidebar row: next to it,
 *  at `want` (bottom-aligned with it unless told), kept inside the window, and on
 *  the row's other side when the sidebar has been dragged wide enough to crowd
 *  the right. */
export function besideRow(
  anchor: DOMRect,
  width: number,
  height: number,
  want = anchor.bottom - height,
): { top: number; left: number } {
  const top = Math.max(MARGIN, Math.min(want, window.innerHeight - height - MARGIN));
  const right = anchor.right + GAP;
  const left =
    right + width > window.innerWidth - MARGIN ? Math.max(MARGIN, anchor.left - width - GAP) : right;
  return { top, left };
}
