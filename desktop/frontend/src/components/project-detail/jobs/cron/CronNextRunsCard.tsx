import { useMemo } from "react";
import { cronFrequency, cronRelative } from "../../../../cronDescribe";
import { nextCronRuns, type CronSpec } from "../../../../cronExpr";
import { formatClock } from "../../../../scheduleBoard";

const SHOWN = 4;

function dayLabel(at: number, now: Date): string {
  const d = new Date(at * 1000);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

// The next few runs the line makes and how busy it is, or why there are none.
export function CronNextRunsCard({ spec }: { spec: CronSpec | null }) {
  const { runs, frequency, now } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    if (!spec) return { runs: [], frequency: "", now };
    return { runs: nextCronRuns(spec, now, SHOWN), frequency: cronFrequency(spec, now), now };
  }, [spec]);
  const today = new Date(now * 1000);

  return (
    <div className="rounded-xl bg-[var(--bg-secondary)]/40 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Next runs</span>
        <span className="text-[12px] text-[var(--text-muted)]">{frequency}</span>
      </div>
      {runs.length === 0 ? (
        <div className="border-t border-[var(--border)]/70 py-1.5 text-[13px] text-[var(--text-muted)]">
          {spec ? "Never matches a real date" : "Waiting for a valid cron line"}
        </div>
      ) : (
        runs.map((at) => (
          <div
            key={at}
            className="flex items-baseline gap-3 border-t border-[var(--border)]/70 py-1.5 text-[13px] tabular-nums"
          >
            <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
              {dayLabel(at, today)}
            </span>
            <span className="font-medium text-[var(--text-primary)]">{formatClock(at)}</span>
            <span className="w-20 text-right text-[var(--text-muted)]">{cronRelative(at, now)}</span>
          </div>
        ))
      )}
    </div>
  );
}
