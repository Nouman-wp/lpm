import { useMemo } from "react";
import { useSettingsStore } from "../../store/settings";
import { RECAP_DEFAULT_THEME, type RecapTheme } from "./recapCardTheme";
import { recapView, withoutRows, type RecapRow, type RecapView, type WeeklyRecap } from "./weeklyRecapModel";

const NONE: RecapRow[] = [];

/** The card as it was last shared: its theme, and without the rows left off. */
export function useRecapLook(recap: WeeklyRecap | null): {
  full: RecapView | null;
  view: RecapView | null;
  theme: RecapTheme;
  leftOut: RecapRow[];
} {
  const theme = useSettingsStore((s) => s.weeklyRecapTheme ?? RECAP_DEFAULT_THEME);
  const leftOut = useSettingsStore((s) => s.weeklyRecapLeftOut ?? NONE);
  const full = useMemo(() => recap && recapView(recap), [recap]);
  const view = useMemo(() => full && withoutRows(full, leftOut), [full, leftOut]);
  return { full, view, theme, leftOut };
}
