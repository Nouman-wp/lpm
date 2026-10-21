import { mix } from "../ansi";

// The handful of tones every agent draws with, read from the terminal's own
// theme so a shaded prompt or a faint rule still reads in light mode.
export interface Palette {
  muted: string;
  faint: string;
  shade: string;
  green: string;
  red: string;
  pick: (dark: string, light: string) => string;
}

const DARK = { bg: "#1a1a1a", fg: "#cccccc" };

function terminalColors(): { bg: string; fg: string } {
  if (typeof document === "undefined") return DARK;
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  };
  return { bg: read("--terminal-bg", DARK.bg), fg: read("--terminal-fg", DARK.fg) };
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function palette(): Palette {
  const { bg, fg } = terminalColors();
  const light = luminance(bg) > 0.5;
  const pick = (dark: string, lite: string) => (light ? lite : dark);
  return {
    muted: "#8a8a8a",
    faint: mix(bg, fg, 0.28),
    shade: mix(bg, fg, 0.09),
    green: pick("#5ffa68", "#2f9e44"),
    red: pick("#ff6e67", "#c91b00"),
    pick,
  };
}
