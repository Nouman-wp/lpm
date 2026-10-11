import { useMemo } from "react";
import type { JobDraft } from "../../../jobsFormat";
import { draftToSchedule } from "../../../jobsScheduleDraft";
import { expandSchedule } from "../../../jobsOccurrences";
import { formatClock } from "../../../scheduleBoard";

const SHOWN = 4;
const LOOKAHEAD_SECS = 400 * 86400;

// The next few runs the draft would make, so a schedule can be checked against
// a calendar before it's saved.
export function NextRunsPreview({ draft }: { draft: JobDraft }) {
  const runs = useMemo(() => {
    const schedule = draftToSchedule(draft);
    const now = Math.floor(Date.now() / 1000);
    const { slots } = expandSchedule(
      schedule ?? undefined,
      { from: now, to: now + LOOKAHEAD_SECS },
      { lastRunAt: now },
    );
    return slots.filter((s) => s.at > now).slice(0, SHOWN);
  }, [draft]);

  if (runs.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Next runs
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {runs.map((run) => (
          <div
            key={run.at}
            className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-secondary)]/40 px-3 py-1.5 text-[12px] tabular-nums"
          >
            <span className="text-[var(--text-secondary)]">
              {new Date(run.at * 1000).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="font-medium text-[var(--text-primary)]">
              {run.approximate ? "~" : ""}
              {formatClock(run.at)}
              {run.untilAt !== undefined ? `–${formatClock(run.untilAt)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
