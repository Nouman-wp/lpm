import { getSettings, useSettingsStore, type Settings } from "../store/settings";
import { terminalFontStack } from "../components/terminal-utils";

export const DEFAULT_TERMINAL_LINE_HEIGHT = 1;
export const MIN_TERMINAL_LINE_HEIGHT = 1;
export const MAX_TERMINAL_LINE_HEIGHT = 2;

export interface TerminalFont {
  family?: string;
  fontFamily: string;
  lineHeight: number;
}

function clampLineHeight(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_TERMINAL_LINE_HEIGHT;
  }
  return Math.min(
    MAX_TERMINAL_LINE_HEIGHT,
    Math.max(MIN_TERMINAL_LINE_HEIGHT, value),
  );
}

// Steps of a tenth, so repeated steps don't drift off the values shown.
export function steppedTerminalLineHeight(lineHeight: number, delta: number): number {
  return clampLineHeight(Math.round((lineHeight + delta) * 10) / 10);
}

export function terminalFontOf({
  terminalFontFamily,
  terminalLineHeight,
}: Pick<Settings, "terminalFontFamily" | "terminalLineHeight">): TerminalFont {
  return {
    family: terminalFontFamily,
    fontFamily: terminalFontStack(terminalFontFamily),
    lineHeight: clampLineHeight(terminalLineHeight),
  };
}

export function useTerminalFont(): TerminalFont {
  const terminalFontFamily = useSettingsStore((s) => s.terminalFontFamily);
  const terminalLineHeight = useSettingsStore((s) => s.terminalLineHeight);
  return terminalFontOf({ terminalFontFamily, terminalLineHeight });
}

export function getTerminalFont(): TerminalFont {
  return terminalFontOf(getSettings());
}
