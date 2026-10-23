import { formatElapsed } from "../backgroundRunToastText";

export const RUN_CARD_WIDTH = 380;
// How long a passed run's card stays up before closing itself.
export const RUN_CARD_AUTO_CLOSE_MS = 4000;

const GAP = 8;
const EDGE = 12;
// Under the header, where the header's own actions are.
const FALLBACK_TOP = 56;

export interface RunCardPlacement {
  left: number;
  top?: number;
  bottom?: number;
}

interface Box {
  top: number;
  bottom: number;
  right: number;
}

/** Where a run's card opens: right-aligned under the button that started it,
 *  or over it when the button sits in the lower half (the footer). A run with
 *  no button on screen, like one a phone started, opens under the header. */
export function placeRunCard(anchor: Box | null, view: { width: number; height: number }): RunCardPlacement {
  const maxLeft = Math.max(EDGE, view.width - EDGE - RUN_CARD_WIDTH);
  if (!anchor) return { top: FALLBACK_TOP, left: maxLeft };
  const left = Math.min(Math.max(anchor.right - RUN_CARD_WIDTH, EDGE), maxLeft);
  return anchor.top < view.height / 2
    ? { top: anchor.bottom + GAP, left }
    : { bottom: view.height - anchor.top + GAP, left };
}

export function findRunAnchor(runKey: string): DOMRect | null {
  for (const el of document.querySelectorAll(`[data-action-run="${CSS.escape(runKey)}"]`)) {
    if (el.getClientRects().length > 0) return el.getBoundingClientRect();
  }
  return null;
}

/** "1.2 s" for a quick run, "45s" and "2m 5s" beyond ten seconds. */
export function runDuration(ms: number): string {
  if (ms < 10_000) return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
  return formatElapsed(ms);
}
