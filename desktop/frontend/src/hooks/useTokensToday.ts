import { useCallback, useEffect, useRef, useState } from "react";
import { AgentUsageMachines } from "../../bridge/commands";
import { LOCAL_MACHINE } from "../components/stats/statsMachines";
import type { AgentUsageStats as AgentUsageStatsData, MachinesUsage } from "../types";
import { onLimitsChanged } from "./useAgentLimits";

// The backend prunes today's scan by file mtime, so a refresh only parses the
// sessions that actually ran — cheap enough to repeat while the app is open,
// but not cheap enough to run on every keystroke of agent output.
const POLL_MS = 3 * 60 * 1000;
const EVENT_THROTTLE_MS = 30 * 1000;

export interface TokensTodayState {
  stats: AgentUsageStatsData | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

/** Today's token spend across the agent CLIs, on this Mac or the paired machine
 *  `host`. `enabled` is false wherever the user has turned the display off, so
 *  nothing is scanned for a hidden view. */
export function useTokensToday(enabled = true, host: string | null = null): TokensTodayState {
  // Each machine's last reading, so moving between machines keeps its rows.
  const [readings, setReadings] = useState<Record<string, AgentUsageStatsData | null>>({});
  const machine = host ?? LOCAL_MACHINE;
  const stats = readings[machine] ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const token = useRef(0);
  const lastRun = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // `fresh` scans again; otherwise a read from the last minute is reused, as
  // when coming back to a machine.
  const read = useCallback(
    async (fresh: boolean) => {
      const mine = ++token.current;
      const current = () => alive.current && mine === token.current;
      lastRun.current = Date.now();
      setLoading(true);
      try {
        const usage = (await AgentUsageMachines(1, machine, fresh)) as MachinesUsage | null;
        if (current()) {
          setReadings((prev) => ({ ...prev, [machine]: usage?.stats ?? null }));
          setError("");
        }
      } catch (cause) {
        if (current()) setError(String(cause));
      } finally {
        if (current()) setLoading(false);
      }
    },
    [machine],
  );
  const refresh = useCallback(() => read(true), [read]);

  useEffect(() => {
    if (!enabled) return;
    void read(false);
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    // A limits push means an agent just reported work, which is the closest
    // thing to a "tokens changed" signal the app gets.
    const off = onLimitsChanged(host, () => {
      if (Date.now() - lastRun.current >= EVENT_THROTTLE_MS) void refresh();
    });
    return () => {
      window.clearInterval(timer);
      if (typeof off === "function") off();
    };
  }, [enabled, host, read, refresh]);

  return { stats, loading, error, refresh };
}
