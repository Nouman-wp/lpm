// The recap card is always in lpm's dark theme, in the app and in the image
// it makes: people's screenshots of their tools are mostly dark.
export const RECAP_COLORS = {
  glow: "#1c2a21",
  ground: "#1f1f1f",
  border: "#3a3a3a",
  text: "#e5e5e5",
  strong: "#ffffff",
  soft: "#b3b3b3",
  muted: "#a3a3a3",
  tile: "#262626",
  green: "#4ade80",
  red: "#f87171",
  onGreen: "#0b2614",
  dayOff: "#4a4a4a",
  markGround: "#2a2a2a",
  markBorder: "#444444",
  markDot: "#22c55e",
  markRing: "#8a8a8a",
} as const;

// Beside the image's mark, for whoever sees the post without knowing lpm.
export const RECAP_TAGLINE = "The free desktop app for coding agents and dev projects";

export const RECAP_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, "Helvetica Neue", sans-serif';

export const RECAP_LAYOUT = {
  width: 600,
  padX: 28,
  padTop: 26,
  padBottom: 24,
  gap: 16,
  radius: 14,
  titleSize: 17,
  headerLine: 22,
  heroSize: 52,
  heroTracking: -0.02,
  bodySize: 15,
  tileGap: 10,
  tileRadius: 10,
  tilePadX: 13,
  tilePadY: 11,
  tileValueLine: 28,
  tileLabelLine: 16,
  rowSize: 14,
  rowLine: 18,
  barHeight: 9,
  barGap: 3,
  day: 28,
  dayGap: 6,
  dayRadius: 7,
  footerLine: 36,
} as const;

/** The angle of the card's green glow, as CSS writes it. */
export const RECAP_GLOW_DEG = 150;
