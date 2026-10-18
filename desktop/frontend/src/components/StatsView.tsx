import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { AgentUsageMachines } from "../../bridge/commands";
import type { AgentUsageStats, MachinesUsage, UsageMachine } from "../types";
import { StatTiles } from "./stats/StatTiles";
import { TokenActivityChart } from "./stats/TokenActivityChart";
import { BreakdownPanel } from "./stats/BreakdownPanel";
import { ProjectsPanel } from "./stats/ProjectsPanel";
import { RecentSessionsPanel } from "./stats/RecentSessionsPanel";
import { StatsSkeleton } from "./stats/StatsSkeleton";
import { ComputerMenu } from "./stats/ComputerMenu";
import { distinctModelCount, providerMeta } from "./stats/statsDerive";
import {
  ALL_MACHINES,
  LOCAL_MACHINE,
  isCounted,
  machineNames,
  machinesNoun,
  statsSubtitle,
} from "./stats/statsMachines";
import { MACHINE } from "../machineWords";

const PERIODS = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "All time" },
] as const;

export function StatsView() {
  const [days, setDays] = useState(30);
  const [machine, setMachine] = useState(ALL_MACHINES);
  const [stats, setStats] = useState<AgentUsageStats | null>(null);
  const [machines, setMachines] = useState<UsageMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // A switch of period or computer retires the read still in flight, so a slow
  // answer for the old pick never lands over the new one.
  const latest = useRef(0);

  const load = useCallback(
    async (fresh = false) => {
      const mine = ++latest.current;
      setLoading(true);
      setError("");
      try {
        const usage = (await AgentUsageMachines(days, machine, fresh)) as MachinesUsage;
        if (mine !== latest.current) return;
        setStats(usage.stats);
        setMachines(usage.machines);
      } catch (cause) {
        if (mine === latest.current) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (mine === latest.current) setLoading(false);
      }
    },
    [days, machine],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const chartDays = useMemo(() => {
    const values = stats?.daily ?? [];
    return days === 0 ? values.slice(-28) : values;
  }, [stats, days]);
  const totalFiles = stats?.sources.reduce((sum, source) => sum + source.files, 0) ?? 0;
  const names = useMemo(() => machineNames(machines), [machines]);
  const several = machines.length > 1 && machine !== LOCAL_MACHINE;
  const noun = machinesNoun(machines);
  const filesWhere =
    machine === ALL_MACHINES
      ? `on ${machines.filter(isCounted).length} ${noun.many}`
      : names[machine]
        ? `on ${names[machine]}`
        : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="app-drag flex items-center gap-4 -mx-6 px-6 py-1">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Stats</h1>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {statsSubtitle(machine, machines)}
          </p>
        </div>
        {machines.length > 1 && (
          <ComputerMenu
            machines={machines}
            selected={machine}
            onSelect={(id) => {
              setStats(null);
              setMachine(id);
            }}
          />
        )}
        <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-0.5">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              onClick={() => {
                if (period.days !== days) {
                  setStats(null);
                  setDays(period.days);
                }
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] ${
                days === period.days
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void load(true)}
          disabled={loading}
          aria-label="Refresh stats"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-[120ms] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] disabled:opacity-50"
        >
          {loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      <div className="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/8 px-4 py-3 text-sm text-[var(--accent-red-text)]">
            <span>Could not load agent stats: {error}</span>
            <button
              onClick={() => void load()}
              className="shrink-0 rounded font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
            >
              Try again
            </button>
          </div>
        )}

        {!error && !stats && loading && <StatsSkeleton days={days} />}

        {stats && (
          <div
            className="space-y-4 pb-2 transition-opacity duration-200"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            <StatTiles
              totals={stats.totals}
              sessions={stats.sessions}
              daily={stats.daily}
              models={stats.models}
              projectCount={stats.projects.length}
              modelCount={distinctModelCount(stats.recentSessions)}
              days={days}
            />

            {stats.totals.totalTokens === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-6 text-center">
                <div className="text-sm font-medium">No local agent usage found</div>
                <p className="mt-1 max-w-md text-xs leading-5 text-[var(--text-muted)]">
                  LPM reads token metadata from Claude Code and Codex session histories. Usage
                  appears here after an agent runs inside a configured local project.
                </p>
                <div className="mt-4 flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                  {(["claude", "codex"] as const).map((key) => {
                    const meta = providerMeta(key);
                    return (
                      <span key={key} className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        {meta.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(280px,0.9fr)] gap-4">
                  <TokenActivityChart daily={chartDays} />
                  <BreakdownPanel providers={stats.providers} totals={stats.totals} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <ProjectsPanel projects={stats.projects} days={days} />
                  <RecentSessionsPanel
                    sessions={stats.recentSessions}
                    days={days}
                    machineNames={names}
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span>
                {several
                  ? `Each ${noun.one} reads its own history and shares only usage numbers.`
                  : `Usage metadata stays on ${MACHINE.thisMachine}.`}{" "}
                Prompts and responses are not included.
              </span>
              <span>
                {totalFiles.toLocaleString()} {several ? "" : "local "}history files scanned
                {several && filesWhere ? ` ${filesWhere}` : ""} · SSH projects excluded
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
