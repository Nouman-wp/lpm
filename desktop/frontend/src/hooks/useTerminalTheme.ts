import { useCallback, useMemo } from "react";
import { useSettingsStore } from "../store/settings";
import {
  type TerminalThemeName,
  isTerminalThemeName,
  getTerminalThemeColors,
  terminalThemeCssVars,
} from "../terminal-themes";

const DEFAULT_THEME: TerminalThemeName = "claude-dark";

export interface UseTerminalThemeResult {
  theme: TerminalThemeName;
  setTheme: (theme: TerminalThemeName) => void;
  themeStyle: React.CSSProperties | undefined;
}

export function terminalThemeOf(value: string | undefined): TerminalThemeName {
  return isTerminalThemeName(value) ? value : DEFAULT_THEME;
}

export function useTerminalTheme(): UseTerminalThemeResult {
  const theme = useSettingsStore((s) => terminalThemeOf(s.terminalTheme));
  const update = useSettingsStore((s) => s.update);

  const setTheme = useCallback(
    (next: TerminalThemeName) => {
      void update({ terminalTheme: next });
    },
    [update],
  );

  const themeStyle = useMemo(() => {
    const colors = getTerminalThemeColors(theme);
    return colors ? (terminalThemeCssVars(colors) as React.CSSProperties) : undefined;
  }, [theme]);

  return { theme, setTheme, themeStyle };
}
