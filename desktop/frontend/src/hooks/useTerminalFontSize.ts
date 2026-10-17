import { useCallback } from "react";
import { useSettingsStore } from "../store/settings";

export const DEFAULT_TERMINAL_FONT_SIZE = 12;
export const MIN_TERMINAL_FONT_SIZE = 8;
export const MAX_TERMINAL_FONT_SIZE = 24;

export interface UseTerminalFontSizeResult {
  fontSize: number;
  zoomIn: () => void;
  zoomOut: () => void;
}

export function terminalFontSizeOf(value: number | undefined): number {
  return value ?? DEFAULT_TERMINAL_FONT_SIZE;
}

export function steppedTerminalFontSize(fontSize: number, delta: number): number {
  return Math.min(MAX_TERMINAL_FONT_SIZE, Math.max(MIN_TERMINAL_FONT_SIZE, fontSize + delta));
}

export function useTerminalFontSize(): UseTerminalFontSizeResult {
  const fontSize = useSettingsStore((s) => terminalFontSizeOf(s.terminalFontSize));
  const update = useSettingsStore((s) => s.update);

  const step = useCallback(
    (delta: number) => {
      const next = steppedTerminalFontSize(fontSize, delta);
      if (next !== fontSize) void update({ terminalFontSize: next });
    },
    [fontSize, update],
  );

  const zoomIn = useCallback(() => step(1), [step]);
  const zoomOut = useCallback(() => step(-1), [step]);

  return { fontSize, zoomIn, zoomOut };
}
