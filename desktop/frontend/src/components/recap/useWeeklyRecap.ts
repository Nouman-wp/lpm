import { useCallback, useEffect, useRef, useState } from "react";
import { WeeklyRecap as LoadWeeklyRecap } from "../../../bridge/commands";
import type { WeeklyRecap } from "./weeklyRecapModel";

// Weeks already read in this window, so Stats, the toast and the recap dialog
// share one scan of the history files.
const read = new Map<string, WeeklyRecap>();

export function loadWeeklyRecap(week: string, fresh = false): Promise<WeeklyRecap> {
  const held = read.get(week);
  if (held && !fresh) return Promise.resolve(held);
  return (LoadWeeklyRecap(week, fresh) as Promise<WeeklyRecap>).then((recap) => {
    read.set(week, recap);
    return recap;
  });
}

/** The recap of the week starting `week`, or null to read none. */
export function useWeeklyRecap(week: string | null) {
  const [recap, setRecap] = useState<WeeklyRecap | null>(() => (week ? read.get(week) ?? null : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(0);

  const load = useCallback(
    async (fresh = false) => {
      if (!week) return;
      const mine = ++latest.current;
      setLoading(true);
      setError("");
      try {
        const next = await loadWeeklyRecap(week, fresh);
        if (mine === latest.current) setRecap(next);
      } catch (cause) {
        if (mine === latest.current) setError(String(cause));
      } finally {
        if (mine === latest.current) setLoading(false);
      }
    },
    [week],
  );

  useEffect(() => {
    setRecap(week ? read.get(week) ?? null : null);
    void load();
  }, [week, load]);

  return { recap: recap?.week === week ? recap : null, loading, error, reload: () => load(true) };
}
