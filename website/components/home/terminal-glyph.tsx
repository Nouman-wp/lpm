/** The app's own terminal mark — a prompt inside a window, not lucide's bare
 *  `>_` — so the sidebar's Terminals row draws the icon the app does. */
export function TerminalGlyph() {
  return (
    <svg
      aria-hidden="true"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="m7 10 2.5 2-2.5 2" />
      <line x1="12.5" y1="14" x2="16" y2="14" />
    </svg>
  );
}
