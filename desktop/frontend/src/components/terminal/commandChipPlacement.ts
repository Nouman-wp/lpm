import type { ChipAnchor } from "../../store/commandChip";

const GAP = 6;
const EDGE = 8;

/** Where the chip goes: on the command's last row, just past its end, when it
 *  fits inside the terminal; otherwise above the command's start, or below it
 *  at the top of the window. */
export function placeCommandChip(
  anchor: ChipAnchor,
  size: { width: number; height: number },
  view: { width: number; height: number },
): { left: number; top: number } {
  const right = Math.min(anchor.right, view.width - EDGE);
  if (anchor.endLeft + GAP + size.width <= right) {
    return { left: anchor.endLeft + GAP, top: anchor.endTop + (anchor.rowHeight - size.height) / 2 };
  }
  const left = Math.min(Math.max(anchor.startLeft, EDGE), Math.max(EDGE, view.width - EDGE - size.width));
  const above = anchor.startTop - size.height - 4;
  if (above >= EDGE) return { left, top: above };
  return { left, top: anchor.endTop + anchor.rowHeight + 4 };
}
