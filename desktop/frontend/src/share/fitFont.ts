// A shared tab renders at the host's columns and rows, never its own, so it fits
// its space by font size instead: the largest whole size, up to the user's own,
// at which the host's grid still fits. Glyph widths don't scale exactly with the
// size, so a size seen to overflow is remembered and never tried again.
export const MIN_SHARED_FONT_SIZE = 6;

export interface FitState {
  // The smallest size seen to overflow, which no later step may reach.
  overflowsAt: number;
}

export function nextFontSize(
  current: number,
  preferred: number,
  ratio: number,
  state: FitState,
): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return current;
  if (ratio < 1) state.overflowsAt = Math.min(state.overflowsAt, current);
  const ceiling = Math.min(preferred, state.overflowsAt - 1);
  const wanted = Math.floor(current * ratio);
  return Math.max(MIN_SHARED_FONT_SIZE, Math.min(ceiling, wanted));
}
