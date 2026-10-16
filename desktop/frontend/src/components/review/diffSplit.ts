// The narrowest diff stack that still shows Split as two readable columns.
// Monaco falls back to the inline view at or below it, and the layout toggle
// says so instead of claiming Split.
export const SPLIT_MIN_WIDTH = 560;

// An unmeasured stack (width 0) is assumed to fit, so the toggle doesn't flicker
// on first paint.
export function splitFits(width: number): boolean {
  return width === 0 || width > SPLIT_MIN_WIDTH;
}

export const LAYOUT_OPTIONS = [
  { value: "split", label: "Split" },
  { value: "unified", label: "Unified" },
] as const;

export const NARROW_LAYOUT_OPTIONS = [
  { value: "split", label: "Split", disabled: true, tooltip: "Too narrow to split — widen the pane" },
  { value: "unified", label: "Unified" },
] as const;
