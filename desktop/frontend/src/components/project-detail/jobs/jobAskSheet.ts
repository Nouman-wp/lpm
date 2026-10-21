// The answer card's buttons, stacked full width like an action sheet: the
// main answer filled, a picked option in the accent color, the rest outlined.
const BASE =
  "min-h-10 w-full rounded-lg border px-3.5 py-2 text-[13.5px] font-semibold transition-colors disabled:opacity-40";

export const SHEET_BUTTON = {
  fill: `${BASE} border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] enabled:hover:opacity-90`,
  picked: `${BASE} border-[var(--accent-cyan)] bg-[color-mix(in_srgb,var(--accent-cyan)_12%,transparent)] text-[var(--text-primary)]`,
  plain: `${BASE} border-[var(--border)] text-[var(--text-primary)] enabled:hover:bg-[var(--bg-hover)]`,
};
